$w = 'c:\Dev\Cursos_DrCotonieto\docs\HISTORIAL_FASES_5_6.md'
$b = [System.IO.File]::ReadAllBytes($w)
$text = [System.Text.Encoding]::UTF8.GetString($b)
$idx = $text.IndexOf('COMUNICADOS_1_HISTORIAL')
Write-Host 'COMUNICADOS at byte offset: ' + $idx
# find the state block: start at the last '- **Estado:**' before the COMUNICADOS mention
$start = $idx
$stateStart = $idx
while ($stateStart -gt 0 -and $text[$stateStart-1] -ne [char]0x0A) { $stateStart-- }
# print bytes from '-' (the '-' of '**Estado:**') ... 200 bytes
$len = 0
while ($len -lt 260 -and $idx + $len -lt $b.Length) {
  $seg = [System.Text.Encoding]::UTF8.GetString($b, $idx, 200)
  break
}
Write-Host '--- CHARS ---'
Write-Host $seg
Write-Host '--- HEX ---'
$hex = [System.Text.Encoding]::UTF8.GetBytes($seg)
for ($i=0; $i -lt $hex.Length; $i++) { Write-Host $hex[$i].ToString('X2') }
