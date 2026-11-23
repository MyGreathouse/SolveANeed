"""Minimal SMTP sink for local E2E tests: writes each email to $MAIL_DIR as <timestamp>_<recipient>.eml."""
import os, time, pathlib
from aiosmtpd.controller import Controller

MAIL_DIR = pathlib.Path(os.environ.get("MAIL_DIR", "./mail"))
MAIL_DIR.mkdir(parents=True, exist_ok=True)

class Handler:
    async def handle_DATA(self, server, session, envelope):
        rcpt = envelope.rcpt_tos[0].replace("@", "_at_")
        (MAIL_DIR / f"{int(time.time() * 1000)}_{rcpt}.eml").write_bytes(envelope.content)
        return "250 OK"

controller = Controller(Handler(), hostname="127.0.0.1", port=int(os.environ.get("SMTP_PORT", "2525")))
controller.start()
print("SMTP sink listening", flush=True)
while True:
    time.sleep(3600)
