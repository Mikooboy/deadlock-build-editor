import json
import sys

from deadlock.builds import (
    build_to_dict,
    builds_to_dict,
    edit_build_in_file,
    load_build_file,
)


def load_builds(path):
    _document, builds = load_build_file(path)
    print(json.dumps(builds_to_dict(builds)))


def edit_build(path, newBuild):
    if isinstance(newBuild, str):
        newBuild = json.loads(newBuild)

    updated = edit_build_in_file(path, newBuild)
    print(
        json.dumps(
            {
                "success": True,
                "build": build_to_dict(updated),
            }
        )
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: api.py <kv3_path> [--edit <json_build>]")

    path = sys.argv[1]

    if len(sys.argv) == 2:
        load_builds(path)
        raise SystemExit(0)

    mode = sys.argv[2]

    if mode == "--edit":
        if len(sys.argv) < 4:
            raise SystemExit("Missing edited build JSON for --edit mode")
        edit_build(path, sys.argv[3])
    else:
        load_builds(path)