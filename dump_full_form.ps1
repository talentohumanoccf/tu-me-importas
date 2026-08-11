$jsonStr = Get-Content "C:\Users\CenCoaPor03.COMFAMILIAR\.gemini\antigravity\scratch\comfamiliar-emergencia\form_data.json" -Raw -Encoding UTF8
$data = ConvertFrom-Json $jsonStr

$questions = $data[1][1]
$idx = 0
foreach ($q in $questions) {
    if ($null -ne $q) {
        $idx++
        $id = $q[0]
        $title = $q[1]
        $desc = $q[2]
        $type = $q[3]
        
        Write-Output "[$idx] ID: $id | TYPE: $type"
        Write-Output "    TITULO: $title"
        if ($desc) { Write-Output "    DESC: $desc" }
        
        if ($q.Count -gt 4 -and $null -ne $q[4]) {
            $opts = $q[4][0][1]
            if ($null -ne $opts) {
                Write-Output "    OPCIONES:"
                foreach ($opt in $opts) {
                    Write-Output "      - $($opt[0])"
                }
            }
        }
        Write-Output "--------------------------------------------------"
    }
}
