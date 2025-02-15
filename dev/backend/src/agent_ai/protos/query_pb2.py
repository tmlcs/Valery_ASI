# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# NO CHECKED-IN PROTOBUF GENCODE
# source: query.proto
# Protobuf Python Version: 5.29.0
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import runtime_version as _runtime_version
from google.protobuf import symbol_database as _symbol_database
from google.protobuf.internal import builder as _builder
_runtime_version.ValidateProtobufRuntimeVersion(
    _runtime_version.Domain.PUBLIC,
    5,
    29,
    0,
    '',
    'query.proto'
)
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n\x0bquery.proto\x12\x08\x61gent_ai\"C\n\x0cQueryRequest\x12\x0f\n\x07message\x18\x01 \x01(\t\x12\x0f\n\x07user_id\x18\x02 \x01(\t\x12\x11\n\ttimestamp\x18\x03 \x01(\x03\"\xba\x03\n\rQueryResponse\x12\x0e\n\x06status\x18\x01 \x01(\t\x12<\n\tsentiment\x18\x02 \x01(\x0b\x32).agent_ai.QueryResponse.SentimentAnalysis\x12\x38\n\x07\x65motion\x18\x03 \x01(\x0b\x32\'.agent_ai.QueryResponse.EmotionAnalysis\x12\x34\n\x05topic\x18\x04 \x01(\x0b\x32%.agent_ai.QueryResponse.TopicAnalysis\x12\x11\n\ttimestamp\x18\x05 \x01(\x03\x12\r\n\x05\x65rror\x18\x06 \x01(\t\x1a\x41\n\x11SentimentAnalysis\x12\r\n\x05label\x18\x01 \x01(\t\x12\r\n\x05score\x18\x02 \x01(\x02\x12\x0e\n\x06rating\x18\x03 \x01(\x05\x1a/\n\x0f\x45motionAnalysis\x12\r\n\x05label\x18\x01 \x01(\t\x12\r\n\x05score\x18\x02 \x01(\x02\x1aU\n\rTopicAnalysis\x12\r\n\x05label\x18\x01 \x01(\t\x12\r\n\x05score\x18\x02 \x01(\x02\x12\x12\n\nall_topics\x18\x03 \x03(\t\x12\x12\n\nall_scores\x18\x04 \x03(\x02\x62\x06proto3')

_globals = globals()
_builder.BuildMessageAndEnumDescriptors(DESCRIPTOR, _globals)
_builder.BuildTopDescriptorsAndMessages(DESCRIPTOR, 'query_pb2', _globals)
if not _descriptor._USE_C_DESCRIPTORS:
  DESCRIPTOR._loaded_options = None
  _globals['_QUERYREQUEST']._serialized_start=25
  _globals['_QUERYREQUEST']._serialized_end=92
  _globals['_QUERYRESPONSE']._serialized_start=95
  _globals['_QUERYRESPONSE']._serialized_end=537
  _globals['_QUERYRESPONSE_SENTIMENTANALYSIS']._serialized_start=336
  _globals['_QUERYRESPONSE_SENTIMENTANALYSIS']._serialized_end=401
  _globals['_QUERYRESPONSE_EMOTIONANALYSIS']._serialized_start=403
  _globals['_QUERYRESPONSE_EMOTIONANALYSIS']._serialized_end=450
  _globals['_QUERYRESPONSE_TOPICANALYSIS']._serialized_start=452
  _globals['_QUERYRESPONSE_TOPICANALYSIS']._serialized_end=537
# @@protoc_insertion_point(module_scope)
