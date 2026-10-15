$path = 'c:\Dev\Cursos_DrCotonieto\docs\HISTORIAL_FASES_5_6.md'
$s = Get-Content -Path $path -Raw -Encoding UTF8
$i = $s.IndexOf('- **Estado:**')
if ($i -lt 0) { Write-Host 'NO FOUND HEAD' ; exit }
$j = $s.IndexOf('`historial.`', $i)
if ($j -lt 0) { Write-Host 'NOT FOUND HIST' ; exit }
$seg = $s.Substring($i, $j - $i + 12)
Write-Host 'LEN=' + $seg.Length
Write-Host $seg
Write-Host '--- HEX ---'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($seg)
for ($k=0; $k -lt $bytes.Length; $k++) { Write-Host ("{0:X2} " -f $bytes[$k]) }
