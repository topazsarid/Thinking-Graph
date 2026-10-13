"""One visible first-in-first-out line for all local-model work.

Ollama on this CPU-only machine answers one request at a time. Every model request
(extraction, chat reply, smart search) waits here in order; the user can see the line
and cancel a waiting or running request. Kept in memory: requests end with the server.
"""
import threading
import time
from uuid import uuid4


class Cancelled(Exception):
    """The user cancelled this request."""


_cond = threading.Condition()
_tickets = {}  # insertion order is queue order; the first entry is the running one
_local = threading.local()


def run(kind, label, work, ref=None):
    """Wait for our turn, then call work(). Raises Cancelled if the user cancels."""
    ticket = dict(id=str(uuid4()), kind=kind, label=label[:90], ref=ref, status='waiting',
                  created_at=time.time(), cancel=threading.Event())
    with _cond:
        _tickets[ticket['id']] = ticket
        try:
            while next(iter(_tickets)) != ticket['id']:
                if ticket['cancel'].is_set():
                    raise Cancelled()
                _cond.wait()
            if ticket['cancel'].is_set():
                raise Cancelled()
            ticket['status'] = 'running'
        except BaseException:
            _tickets.pop(ticket['id'], None)
            _cond.notify_all()
            raise
    _local.cancel = ticket['cancel']
    try:
        return work()
    finally:
        _local.cancel = None
        with _cond:
            _tickets.pop(ticket['id'], None)
            _cond.notify_all()


def check_cancelled():
    """Called while a model answer streams in; stops the running request if cancelled."""
    event = getattr(_local, 'cancel', None)
    if event is not None and event.is_set():
        raise Cancelled()


def cancel(ticket_id):
    with _cond:
        ticket = _tickets.get(ticket_id)
        if not ticket:
            return False
        ticket['cancel'].set()
        if ticket['status'] == 'running':
            ticket['status'] = 'cancelling'
        _cond.notify_all()
        return True


def snapshot():
    with _cond:
        return [{k: t[k] for k in ('id', 'kind', 'label', 'ref', 'status', 'created_at')}
                for t in _tickets.values()]
