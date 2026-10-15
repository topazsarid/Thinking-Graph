"""Small helpers shared by the E2E tests."""
import struct
import zlib
from pathlib import Path


def inside(page, locator, container='svg:has([data-idea-id])'):
    """True when the element is fully visible inside the container (default: the map)."""
    box, outer = locator.bounding_box(), page.locator(container).first.bounding_box()
    return bool(box and outer and box['x'] >= outer['x'] - 1 and box['y'] >= outer['y'] - 1
                and box['x'] + box['width'] <= outer['x'] + outer['width'] + 1
                and box['y'] + box['height'] <= outer['y'] + outer['height'] + 1)


def send(page, text):
    """Send a chat message and return its article."""
    count = page.locator('section.chat article.message').count()
    page.fill('#draft', text)
    page.get_by_label('שליחת הודעה').click()
    page.locator('section.chat article.message').nth(count).wait_for()
    return page.locator('section.chat article.message').nth(count)


def png(path, rgb):
    """Writes a tiny solid-color PNG (for the image effect upload)."""
    raw = b''.join(b'\x00' + bytes(rgb) * 40 for _ in range(40))
    chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    Path(path).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 40, 40, 8, 2, 0, 0, 0))
                           + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))
    return str(path)
