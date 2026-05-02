#!/bin/bash
echo "Current high CPU processes:"
ps -eo pcpu,pid,user,args --sort=-pcpu | head -n 10
echo ""
echo "Payload processes:"
ps aux | grep "payload" | grep -v grep
