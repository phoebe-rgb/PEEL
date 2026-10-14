#!/usr/bin/env python3
"""
Push local PNGs to a PUBLIC Google Drive folder and print the lh3 CDN URLs that
the Meta Ads MCP `ads_creative_upload_image` can fetch (it is URL-only and rejects
drive.google.com SHARE links — but the lh3.googleusercontent.com CDN serves raw
image bytes, which Meta CAN fetch).

Run with the ~/google-api toolkit venv:  ~/google-api/venv/bin/python drive_image_pipeline.py
Needs gauth.drive() (see the [[google-api-toolkit]] memory).

Then curl-verify each URL returns HTTP 200 image/png BEFORE handing to Meta:
  curl -sS -o /dev/null -w "HTTP %{http_code}  %{content_type}\n" -L "<url>"
Feed images must be 1080x1080 (1:1); Story images 1080x1920 (9:16).
"""
import sys
sys.path.insert(0, "/Users/gianganh/google-api")
import gauth
from googleapiclient.http import MediaFileUpload

# EDIT THESE -----------------------------------------------------------------
PUBLIC_FOLDER_ID = "13lCzS4MfKvpWBteqcAvX-SCQeJE0dFeh"  # a Drive folder shared anyone/reader
FILES = {
    # meta_image_name : local_path
    # "SHMS_LuxWebinar_FEED_Speaker": "/path/to/Clientbanner-All.png",
    # "SHMS_LuxWebinar_STORY_Speaker": "/path/to/story/Clientbanner-All.png",
}
# ----------------------------------------------------------------------------

def main():
    drv = gauth.drive()
    for name, path in FILES.items():
        meta = {"name": name + ".png", "parents": [PUBLIC_FOLDER_ID]}
        media = MediaFileUpload(path, mimetype="image/png", resumable=False)
        f = drv.files().create(body=meta, media_body=media, fields="id,name").execute()
        fid = f["id"]
        drv.permissions().create(fileId=fid, body={"type": "anyone", "role": "reader"}).execute()
        print(f"{name}  id={fid}  url=https://lh3.googleusercontent.com/d/{fid}=w1080")

if __name__ == "__main__":
    main()
