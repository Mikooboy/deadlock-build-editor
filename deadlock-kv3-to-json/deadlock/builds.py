import os
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
from google.protobuf.json_format import MessageToDict, ParseDict
from dataclasses import dataclass
import keyvalues3 as kv3
from proto.hero_build_pb2 import CCitadelClientMsg_HeroBuild


@dataclass
class Build:
    source_list: str
    index: int
    result: CCitadelClientMsg_HeroBuild

    @property
    def hero_build(self):
        return self.result.hero_build

    @property
    def id(self):
        return self.hero_build.hero_build_id

    @property
    def hero_id(self):
        return self.hero_build.hero_id

    @property
    def name(self):
        return self.hero_build.name

    @property
    def description(self):
        return self.hero_build.description


def parse_build(data):
    result = CCitadelClientMsg_HeroBuild()
    result.ParseFromString(bytes(data))

    if not result.HasField("hero_build"):
        return None

    return result


def load_build_file(path):
    document = kv3.read(path)

    builds = []

    for source_list, value in document.value.items():
        if not isinstance(value, list):
            continue

        for index, entry in enumerate(value):
            if not isinstance(entry, (bytes, bytearray)):
                continue

            result = parse_build(entry)

            if result is None:
                continue

            builds.append(
                Build(
                    source_list=source_list,
                    index=index,
                    result=result,
                )
            )

    return document, builds


def save_build_file(document, builds, path):
    for build in builds:
        if build.source_list not in document.value:
            raise ValueError(f"Missing source list '{build.source_list}' in kv3 file")
        if not isinstance(document.value[build.source_list], list):
            raise ValueError(f"Source list '{build.source_list}' is not a list")
        if build.index < 0 or build.index >= len(document.value[build.source_list]):
            raise ValueError(
                f"Build index {build.index} is out of range for source list '{build.source_list}'"
            )

        document.value[build.source_list][build.index] = (
            build.result.SerializeToString()
        )

    output = kv3.KV3File(
        document.value,
        format=kv3.FORMAT_GENERIC,
    )

    kv3.write(output, path)


def dict_to_build(data):
    if not isinstance(data, dict):
        raise ValueError("Build payload must be a JSON object")

    payload = dict(data)
    source_list = payload.pop("_sourceList", payload.pop("sourceList", None))
    index = payload.pop("_index", payload.pop("index", None))

    if source_list is None:
        raise ValueError("Build payload is missing _sourceList")
    if index is None:
        raise ValueError("Build payload is missing _index")

    try:
        index = int(index)
    except (TypeError, ValueError) as exc:
        raise ValueError("_index must be an integer") from exc

    result = CCitadelClientMsg_HeroBuild()
    ParseDict(payload, result, ignore_unknown_fields=False)

    return Build(
        source_list=source_list,
        index=index,
        result=result,
    )


def edit_build_in_file(path, data):
    document, builds = load_build_file(path)
    updated = dict_to_build(data)

    if not any(
        build.source_list == updated.source_list and build.index == updated.index
        for build in builds
    ):
        raise ValueError(
            f"No build found at _sourceList='{updated.source_list}' and _index={updated.index}"
        )

    save_build_file(document, [updated], path)
    return updated


def build_to_dict(build):
    data = MessageToDict(build.result)

    data["_sourceList"] = build.source_list
    data["_index"] = build.index

    return data


def builds_to_dict(builds):
    return [build_to_dict(build) for build in builds]