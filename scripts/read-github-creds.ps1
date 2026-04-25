Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class Advapi32 {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags;
        public UInt32 Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }
    [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);
    [DllImport("advapi32.dll", SetLastError=true)]
    public static extern bool CredFree(IntPtr buffer);
}
'@
$target = 'LegacyGeneric:target=GitHub - https://api.github.com/omdawbas2015'
$credPtr = [IntPtr]::Zero
if (-not [Advapi32]::CredRead($target, 1, 0, [ref]$credPtr)) {
    Write-Output 'READ_FAILED'
    exit 1
}
$cred = [Runtime.InteropServices.Marshal]::PtrToStructure($credPtr, [Type][Advapi32+CREDENTIAL])
$user = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.UserName)
$pass = [Runtime.InteropServices.Marshal]::PtrToStringUni($cred.CredentialBlob, [int]$cred.CredentialBlobSize/2)
Write-Output "USER:$user"
Write-Output "PASS:$pass"
[Advapi32]::CredFree($credPtr)
