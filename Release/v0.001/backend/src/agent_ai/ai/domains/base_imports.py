from typing import Dict, Any, Optional, TypeVar, Generic
from abc import ABC, abstractmethod
import logging
import datetime

from agent_ai.core.exceptions import ValidationError, ProcessingError
from agent_ai.core.base import BaseManager
