$path = "C:\Users\CenCoaPor03.COMFAMILIAR\.gemini\antigravity\brain\2b9aca69-36ce-4964-8261-5a2ab60f0a97\.system_generated\steps\167\content.md"
$raw = Get-Content $path -Raw -Encoding UTF8

# Find FB_PUBLIC_LOAD_DATA_
$startIndex = $raw.IndexOf("FB_PUBLIC_LOAD_DATA_ = ")
if ($startIndex -ge 0) {
    $sub = $raw.Substring($startIndex + 23)
    $endIndex = $sub.IndexOf(";</script>")
    if ($endIndex -gt 0) {
        $jsonStr = $sub.Substring(0, $endIndex)
        Set-Content -Path "C:\Users\CenCoaPor03.COMFAMILIAR\.gemini\antigravity\scratch\comfamiliar-emergencia\form_data.json" -Value $jsonStr -Encoding UTF8
        Write-Output "JSON EXTRACTED SUCCESSFULLY"
    }
}
