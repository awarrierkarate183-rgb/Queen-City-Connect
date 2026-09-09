"""Build a clean print PDF of the QueenCityConnect logo for advertising."""
import tempfile
import urllib.request
from pathlib import Path

from reportlab.lib.colors import Color, white
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "assets" / "images" / "logo.png"
OUT = ROOT / "assets" / "images" / "QueenCityConnect-logo.pdf"
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/dmserifdisplay/DMSerifDisplay-Regular.ttf"

GREEN = Color(26 / 255, 65 / 255, 46 / 255)
MUTED = Color(90 / 255, 90 / 255, 86 / 255)


def draw_centered_image(c, path, cx, cy, size):
    img = ImageReader(str(path))
    c.drawImage(
        img,
        cx - size / 2,
        cy - size / 2,
        width=size,
        height=size,
        mask="auto",
        preserveAspectRatio=True,
    )


def page_lockup(c, width, height):
    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    mark = 3.4 * inch
    cxy = height * 0.58
    draw_centered_image(c, LOGO, width / 2, cxy, mark)

    pdfmetrics.registerFont(TTFont("DMSerif", str(FONT_PATH)))
    name = "QueenCityConnect"
    c.setFillColor(GREEN)
    c.setFont("DMSerif", 36)
    c.drawCentredString(width / 2, cxy - mark / 2 - 0.72 * inch, name)

    c.setFillColor(MUTED)
    c.setFont("Times-Roman", 13)
    c.drawCentredString(
        width / 2,
        cxy - mark / 2 - 1.05 * inch,
        "Charlotte-Mecklenburg Community Resources",
    )


def page_mark_only(c, width, height):
    c.setFillColor(white)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    draw_centered_image(c, LOGO, width / 2, height / 2, 5.1 * inch)


def main():
    global FONT_PATH
    tmp = Path(tempfile.mkdtemp())
    FONT_PATH = tmp / "DMSerifDisplay-Regular.ttf"
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)

    width, height = 8.5 * inch, 11 * inch
    c = canvas.Canvas(str(OUT), pagesize=(width, height))
    c.setTitle("QueenCityConnect Logo")
    c.setAuthor("QueenCityConnect")
    c.setSubject("Official logo for print and advertising")
    c.setCreator("QueenCityConnect")

    page_lockup(c, width, height)
    c.showPage()
    page_mark_only(c, width, height)
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()
