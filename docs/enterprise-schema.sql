-- Enterprise Refund Management PostgreSQL Schema
-- Target normalized SQL design for the production platform.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE refund_request_status AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE refund_component_status AS ENUM ('PENDING', 'REFUNDED', 'KNET_PENDING', 'KNET_REFUNDED', 'AURA_PENDING', 'AURA_REFUNDED');
CREATE TYPE payment_type AS ENUM ('CARD', 'APPLE_PAY', 'CREDIT_CARD', 'KNET', 'AURA');
CREATE TYPE email_status AS ENUM ('QUEUED', 'SENT', 'FAILED', 'RETRIED', 'ESCALATED');
CREATE TYPE workflow_trigger AS ENUM ('APPROVAL', 'STATUS_CHANGE', 'DELAY', 'EMAIL_RESPONSE');

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  country_code text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email citext NOT NULL,
  customer_phone text,
  country_code text NOT NULL,
  branch_name text,
  currency text NOT NULL,
  order_amount numeric(12, 3) NOT NULL CHECK (order_amount >= 0),
  order_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type payment_type NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_external boolean NOT NULL DEFAULT false,
  requires_external_reference boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id),
  created_by_id uuid REFERENCES users(id),
  assigned_agent_id uuid REFERENCES users(id),
  status refund_request_status NOT NULL DEFAULT 'PENDING',
  refund_reason text NOT NULL,
  root_cause text,
  requested_amount numeric(12, 3) NOT NULL CHECK (requested_amount >= 0),
  approved_at timestamptz,
  approved_by_id uuid REFERENCES users(id),
  refunded_at timestamptz,
  closed_by_id uuid REFERENCES users(id),
  sla_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refund_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid NOT NULL REFERENCES refund_requests(id) ON DELETE CASCADE,
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  payment_type payment_type NOT NULL,
  amount numeric(12, 3) NOT NULL CHECK (amount > 0),
  status refund_component_status NOT NULL DEFAULT 'PENDING',
  external_reference text,
  arn text,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  payment_type payment_type NOT NULL,
  primary_email text NOT NULL,
  escalation_email text,
  sla_hours integer NOT NULL DEFAULT 48 CHECK (sla_hours > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipient_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipient_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES recipient_groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  channel text NOT NULL DEFAULT 'TO' CHECK (channel IN ('TO', 'CC', 'BCC')),
  UNIQUE (group_id, email, channel)
);

CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  trigger workflow_trigger NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  template_id uuid REFERENCES templates(id),
  recipient_group_id uuid REFERENCES recipient_groups(id),
  external_team_id uuid REFERENCES external_teams(id),
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_policy jsonb NOT NULL DEFAULT '{"maxAttempts":3,"delayMinutes":60}'::jsonb,
  escalation_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid REFERENCES refund_requests(id),
  refund_component_id uuid REFERENCES refund_components(id),
  template_id uuid REFERENCES templates(id),
  status email_status NOT NULL DEFAULT 'QUEUED',
  subject text NOT NULL,
  recipients_to text[] NOT NULL DEFAULT ARRAY[]::text[],
  recipients_cc text[] NOT NULL DEFAULT ARRAY[]::text[],
  recipients_bcc text[] NOT NULL DEFAULT ARRAY[]::text[],
  provider_message_id text,
  response_payload jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  actor_name text,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_refund_requests_status ON refund_requests(status);
CREATE INDEX idx_refund_requests_order_id ON refund_requests(order_id);
CREATE INDEX idx_refund_requests_agent_status ON refund_requests(assigned_agent_id, status);
CREATE INDEX idx_refund_requests_sla_due_at ON refund_requests(sla_due_at) WHERE status IN ('PENDING', 'APPROVED', 'PARTIALLY_REFUNDED');
CREATE INDEX idx_refund_components_request ON refund_components(refund_request_id);
CREATE INDEX idx_refund_components_status_payment ON refund_components(status, payment_type);
CREATE INDEX idx_email_logs_component_status ON email_logs(refund_component_id, status);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
