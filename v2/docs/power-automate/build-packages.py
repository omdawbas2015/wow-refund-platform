#!/usr/bin/env python3
"""
Build importable Power Automate Legacy Packages (.zip) from the flow
definitions checked in next door.

Each output zip has the layout Power Automate's
"+ Import → Import Package (Legacy)" expects:

    <package>.zip
    ├── manifest.json
    └── Microsoft.Flow/
        ├── flows/
        │   └── manifest.json
        └── flows/
            └── <flowGuid>/
                ├── apisMap.json
                ├── connectionsMap.json
                └── definition.json

Run from the repo root:
    python3 v2/docs/power-automate/build-packages.py

Output:
    v2/docs/power-automate/packages/wow-outbound-mailer.zip
    v2/docs/power-automate/packages/wow-inbound-listener.zip
"""

from __future__ import annotations
import json
import os
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path

REPO_DOCS = Path(__file__).resolve().parent
FLOWS_DIR = REPO_DOCS / "flows"
PACKAGES_DIR = REPO_DOCS / "packages"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.0000000Z")


def add_authentication_parameter(actions: dict) -> None:
    """
    Walk the actions tree and add `authentication: @parameters('$authentication')`
    to every OpenApiConnection / OpenApiConnectionWebhook input that doesn't
    already have one. Power Automate refuses to bind a connection at import
    time without it.
    """
    for action in actions.values():
        atype = action.get("type")
        if atype in ("OpenApiConnection", "OpenApiConnectionWebhook"):
            inputs = action.setdefault("inputs", {})
            inputs.setdefault("authentication", "@parameters('$authentication')")
        # If/Switch/Scope/Foreach can have nested actions
        if "actions" in action and isinstance(action["actions"], dict):
            add_authentication_parameter(action["actions"])
        if "else" in action and isinstance(action["else"], dict):
            add_authentication_parameter(action["else"].get("actions", {}))
        if "cases" in action and isinstance(action["cases"], dict):
            for case in action["cases"].values():
                add_authentication_parameter(case.get("actions", {}))
        if "default" in action and isinstance(action["default"], dict):
            add_authentication_parameter(action["default"].get("actions", {}))


def add_trigger_authentication(triggers: dict) -> None:
    for trig in triggers.values():
        if trig.get("type") in ("OpenApiConnection", "OpenApiConnectionWebhook"):
            inputs = trig.setdefault("inputs", {})
            inputs.setdefault("authentication", "@parameters('$authentication')")


# Connector metadata.  These IDs are the public connector identifiers — the
# import wizard will resolve them against the user's tenant and prompt the
# user to pick / create a real connection.
OFFICE365_API_ID = "/providers/Microsoft.PowerApps/apis/shared_office365"
OFFICE365_API_NAME = "shared_office365"
OFFICE365_DISPLAY = "Office 365 Outlook"
OFFICE365_ICON = (
    "https://connectoricons-prod.azureedge.net/releases/v1.0.1467/1.0.1467.2407/"
    "office365/icon.png"
)


def build_flow_resource(
    *,
    flow_id: str,
    display_name: str,
    description: str,
    depends_on: list[str],
) -> dict:
    return {
        "type": "Microsoft.Flow/flows",
        "suggestedCreationType": "New",
        "creationType": "New",
        "details": {"displayName": display_name, "description": description},
        "configurableBy": "User",
        "hierarchy": "Root",
        "dependsOn": depends_on,
    }


def build_office365_api_resource() -> dict:
    return {
        "id": OFFICE365_API_ID,
        "name": OFFICE365_API_NAME,
        "type": "Microsoft.PowerApps/apis",
        "suggestedCreationType": "Existing",
        "details": {"displayName": OFFICE365_DISPLAY, "iconUri": OFFICE365_ICON},
        "configurableBy": "System",
        "hierarchy": "Child",
        "dependsOn": [],
    }


def build_office365_connection_resource(api_resource_id: str) -> dict:
    return {
        "type": "Microsoft.PowerApps/apis/connections",
        "suggestedCreationType": "Existing",
        "creationType": "Existing",
        "details": {
            "displayName": OFFICE365_DISPLAY,
            "iconUri": OFFICE365_ICON,
        },
        "configurableBy": "User",
        "hierarchy": "Child",
        "dependsOn": [api_resource_id],
    }


def build_package(
    *,
    package_name: str,
    display_name: str,
    description: str,
    flow_definition_path: Path,
    output_path: Path,
) -> None:
    raw_definition = json.loads(flow_definition_path.read_text("utf-8"))

    # The Power Automate definition format requires every connector
    # action / trigger to carry an authentication parameter. Add it
    # if it's missing.
    add_authentication_parameter(raw_definition.get("actions", {}))
    add_trigger_authentication(raw_definition.get("triggers", {}))

    # Make sure the definition declares the $connections / $authentication
    # parameters Power Automate expects.
    params = raw_definition.setdefault("parameters", {})
    params.setdefault(
        "$connections",
        {"defaultValue": {}, "type": "Object"},
    )
    params.setdefault(
        "$authentication",
        {"defaultValue": {}, "type": "SecureObject"},
    )

    flow_id = str(uuid.uuid4())
    api_resource_id = str(uuid.uuid4())
    connection_resource_id = str(uuid.uuid4())

    # Per-flow definition.json — the manual export wraps the workflow
    # definition in a small Microsoft.Flow envelope.
    flow_definition = {
        "name": flow_id,
        "id": f"/providers/Microsoft.Flow/flows/{flow_id}",
        "type": "Microsoft.Flow/flows",
        "properties": {
            "apiId": "/providers/Microsoft.PowerApps/apis/shared_logicflows",
            "displayName": display_name,
            "definition": raw_definition,
            "connectionReferences": {
                OFFICE365_API_NAME: {
                    "connectionName": OFFICE365_API_NAME,
                    "source": "Embedded",
                    "id": OFFICE365_API_ID,
                    "tier": "NotSpecified",
                }
            },
            "flowFailureAlertSubscribed": False,
            "isManaged": False,
        },
        "schemaVersion": "1.0.0.0",
    }

    apis_map = {OFFICE365_API_NAME: api_resource_id}
    connections_map = {OFFICE365_API_NAME: connection_resource_id}

    flow_resource = build_flow_resource(
        flow_id=flow_id,
        display_name=display_name,
        description=description,
        depends_on=[api_resource_id, connection_resource_id],
    )
    api_resource = build_office365_api_resource()
    connection_resource = build_office365_connection_resource(api_resource_id)

    package_manifest = {
        "schema": "1.0",
        "details": {
            "displayName": display_name,
            "description": description,
            "createdTime": utc_now_iso(),
            "packageTelemetryId": str(uuid.uuid4()),
            "creator": "WOW Refund Platform",
            "sourceEnvironment": "",
        },
        "resources": {
            flow_id: flow_resource,
            api_resource_id: api_resource,
            connection_resource_id: connection_resource,
        },
    }

    flows_index_manifest = {
        "packageSchemaVersion": "1.0",
        "flowAssets": {"assetPaths": [flow_id]},
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:

        def write_json(arcname: str, data: dict) -> None:
            zf.writestr(arcname, json.dumps(data, separators=(",", ":")))

        write_json("manifest.json", package_manifest)
        write_json("Microsoft.Flow/flows/manifest.json", flows_index_manifest)
        write_json(
            f"Microsoft.Flow/flows/{flow_id}/definition.json", flow_definition
        )
        write_json(
            f"Microsoft.Flow/flows/{flow_id}/apisMap.json", apis_map
        )
        write_json(
            f"Microsoft.Flow/flows/{flow_id}/connectionsMap.json", connections_map
        )

    print(
        f"  built {output_path.relative_to(REPO_DOCS.parent)}\n"
        f"     flowId={flow_id}\n"
        f"     name=\"{display_name}\"",
        file=sys.stderr,
    )


def main() -> int:
    PACKAGES_DIR.mkdir(parents=True, exist_ok=True)

    build_package(
        package_name="wow-outbound-mailer",
        display_name="WOW Refund — Outbound mailer (HTTP → Outlook)",
        description=(
            "HTTP-triggered flow used by the WOW Refund platform to send "
            "approval / KNET / Aura emails through the operator mailbox. "
            "Verifies the X-Wow-Signature header against the value of "
            "POWER_AUTOMATE_SIGNING_SECRET before sending the email."
        ),
        flow_definition_path=FLOWS_DIR / "outbound-flow-definition.json",
        output_path=PACKAGES_DIR / "wow-outbound-mailer.zip",
    )

    build_package(
        package_name="wow-inbound-listener",
        display_name="WOW Refund — Inbound listener (Outlook → webhook)",
        description=(
            "Mailbox trigger flow used by the WOW Refund platform to forward "
            "approval / KNET / Aura replies into the platform webhook. "
            "Filters on subject prefixes (APB- / KNET- / AURA-) and posts a "
            "normalised payload with a shared inbound secret in the header."
        ),
        flow_definition_path=FLOWS_DIR / "inbound-flow-definition.json",
        output_path=PACKAGES_DIR / "wow-inbound-listener.zip",
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
