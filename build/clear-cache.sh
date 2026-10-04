#!/bin/bash
# Clears the Cache Enabler page cache. Run from (or set WP_PATH to) your WordPress install root.
cd "${WP_PATH:-.}" && wp eval 'do_action("cache_enabler_clear_complete_cache");' && echo "page cache cleared"
