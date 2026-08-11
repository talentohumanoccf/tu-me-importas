$jsonStr = Get-Content "C:\Users\CenCoaPor03.COMFAMILIAR\.gemini\antigravity\scratch\comfamiliar-emergencia\form_data.json" -Raw -Encoding UTF8
$data = ConvertFrom-Json $jsonStr

$formTitle = $data[1][8]
$formDesc = $data[1][0]

Write-Output "=========================================="
Write-Output "TITULO: $formTitle"
Write-Output "DESCRIPCION: $formDesc"
Write-Output "=========================================="

$questions = $data[1][1]
$idx = 1
foreach ($q in $questions) {
    if ($null -ne $q) {
        $qText = $q[1]
        $qDesc = $q[2]
        Write-Output ""
        Write-Output "--- PREGUNTA $idx ---"
        Write-Output "TEXTO: $qText"
        if ($qDesc) { Write-Output "DESCRIPCION: $qDesc" }
        
        if ($q.Count -gt 4 -and $null -ne $q[4]) {
            $opts = $q[4][0][1]
            if ($null -ne $opts) {
                Write-Output "OPCIONES:"
                foreach ($opt in $opts) {
                    $optText = $opt[0]
                    Write-Output "  - $optText"
                }
            }
        }
        $idx++
    }
}
