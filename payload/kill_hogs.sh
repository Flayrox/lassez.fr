#!/bin/bash
echo "Stopping all payload run processes..."
ps aux | grep "payload run" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null
echo "Done."
