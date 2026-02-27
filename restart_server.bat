@echo off
C:\Windows\System32\OpenSSH\ssh.exe root@72.62.40.134 "pm2 restart trying --update-env; sleep 8; curl -sf http://localhost:5000/api/health && echo ' HEALTHY' || echo ' FAILED'"
