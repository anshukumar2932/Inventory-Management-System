import hashlib
import io
import barcode
from barcode.writer import ImageWriter


def barcode_generator(raw):
    barcode_val = hashlib.sha256(raw.encode()).hexdigest()[:20].upper()
    return barcode_val


def generate_barcode_image(code):
    try:
        writer = ImageWriter()
        writer.set_options({"module_width": 0.2, "module_height": 15, "font_size": 8, "text_distance": 2, "quiet_zone": 2})
        barcode_cls = barcode.get_barcode_class("code128")
        bar = barcode_cls(code, writer=writer)
        buf = io.BytesIO()
        bar.write(buf)
        buf.seek(0)
        return buf
    except Exception:
        return None