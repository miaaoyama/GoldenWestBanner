"""
data/generate_pdf.py
──────────────────────────────────────────────────────────────────────────────
Generates data/GoldenWest_Student_Profiles.pdf from the 100 student JSONs.

Plain black-and-white layout — optimised for machine reading by the
Amazon Bedrock Knowledge Base agent (no colour, clean labels, consistent
field structure).

Run:  python3 data/generate_pdf.py
Requires: fpdf2  (pip3 install fpdf2)
"""

import json
from pathlib import Path
from fpdf import FPDF
from fpdf.enums import XPos, YPos

# ── Paths ─────────────────────────────────────────────────────────────────
STUDENTS_DIR = Path(__file__).parent / "students"
OUTPUT_PDF   = Path(__file__).parent / "GoldenWest_Student_Profiles.pdf"

# ── Layout constants ──────────────────────────────────────────────────────
PAGE_W     = 210
PAGE_H     = 297
MARGIN_L   = 12
MARGIN_R   = 12
MARGIN_TOP = 12
MARGIN_BOT = 14
CONTENT_W  = PAGE_W - MARGIN_L - MARGIN_R   # 186 mm
ROW_H      = 4.8
SEC_HDR_H  = 6.0
LBL_W      = 40
VAL_W      = 51
COL_GAP    = 2

# ── Greyscale only ────────────────────────────────────────────────────────
BLACK      = (0,   0,   0)
WHITE      = (255, 255, 255)
DARK_GRAY  = (40,  40,  40)
MID_GRAY   = (100, 100, 100)
LIGHT_GRAY = (230, 230, 230)   # alternating row shade
HDR_FILL   = (50,  50,  50)    # section header background

SECTION_LABELS = {
    "banner_sis":  "BANNER SIS -- Student Information System",
    "fafsa_cadaa": "FAFSA / CADAA -- Financial Aid",
    "cccapply":    "CCCAPPLY -- Application Data",
}

# ── Text helpers ──────────────────────────────────────────────────────────

def safe(text) -> str:
    return (
        str(text)
        .replace("\u2014", "--").replace("\u2013", "-")
        .replace("\u2019", "'").replace("\u2018", "'")
        .replace("\u201c", '"').replace("\u201d", '"')
        .replace("\u00b7", ".").replace("\u2022", "*")
        .encode("latin-1", errors="replace").decode("latin-1")
    )

def fmt_key(k: str) -> str:
    return k.replace("_", " ").title()

def fmt_val(v) -> str:
    if v is None:
        return "-"
    if isinstance(v, bool):
        return "Yes" if v else "No"
    if isinstance(v, list):
        return (", ".join(str(x) for x in v)) if v else "-"
    if isinstance(v, dict):
        return " | ".join(f"{a}: {b}" for a, b in v.items() if b is not None)
    return str(v)


# ── PDF class ─────────────────────────────────────────────────────────────

class StudentPDF(FPDF):

    def __init__(self, total: int):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.total    = total
        self._cur_sec = None
        self.set_auto_page_break(auto=False)
        self.set_margins(MARGIN_L, MARGIN_TOP, MARGIN_R)

    def bottom_limit(self) -> float:
        return PAGE_H - MARGIN_BOT - 6

    def check_page_break(self, needed_mm: float):
        if self.get_y() + needed_mm > self.bottom_limit():
            self.add_page()
            if self._cur_sec:
                self._section_header(self._cur_sec, continued=True)

    # ── Cover page ────────────────────────────────────────────────────────

    def cover_page(self):
        self.add_page()

        # Title block — dark bar, white text
        self.set_fill_color(*HDR_FILL)
        self.rect(0, 0, PAGE_W, 52, style="F")

        self.set_font("Helvetica", "B", 22)
        self.set_text_color(*WHITE)
        self.set_xy(MARGIN_L, 12)
        self.cell(CONTENT_W, 11, "Golden West College", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_font("Helvetica", "", 12)
        self.cell(CONTENT_W, 7, "Student Portal -- Synthetic Test Profiles", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_font("Helvetica", "I", 9)
        self.set_text_color(200, 200, 200)
        self.cell(CONTENT_W, 6, "CCCApply  |  Banner SIS  |  FAFSA / CADAA", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Record count
        self.set_y(62)
        self.set_font("Helvetica", "B", 36)
        self.set_text_color(*DARK_GRAY)
        self.cell(CONTENT_W, 16, f"{self.total} Student Profiles", align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Warning notice
        self.ln(4)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*DARK_GRAY)
        self.cell(CONTENT_W, 7,
                  "WARNING: FAKE DATA -- For development and testing only.",
                  align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MID_GRAY)
        self.cell(CONTENT_W, 6,
                  "Not real student records. Do not use for official purposes.",
                  align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Divider
        self.ln(6)
        self.set_draw_color(*MID_GRAY)
        self.set_line_width(0.4)
        self.line(MARGIN_L, self.get_y(), PAGE_W - MARGIN_R, self.get_y())

        # Section guide
        self.ln(7)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*DARK_GRAY)
        self.cell(CONTENT_W, 6, "Sections per student profile:",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

        for label in SECTION_LABELS.values():
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*WHITE)
            self.set_fill_color(*HDR_FILL)
            self.set_x(MARGIN_L)
            self.cell(120, 6, f"  {label}", fill=True,
                      new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(1.5)

    # ── Per-student page(s) ───────────────────────────────────────────────

    def student_pages(self, profile: dict, index: int):
        self.add_page()

        sis  = profile.get("banner_sis", {})
        name = safe(f"{sis.get('first_name','')} {sis.get('middle_initial','') or ''} {sis.get('last_name','')}".replace("  ", " ").strip())
        cwid = safe(sis.get("cwid", "N/A"))
        prog = safe(sis.get("program_of_study", "-"))
        yr   = safe(sis.get("year_in_college", "-"))
        enr  = safe(sis.get("enrollment_status", "-"))
        gpa_v = sis.get("cumulative_gpa")
        gpa  = safe(f"{gpa_v:.2f}" if gpa_v else "-")

        # Student header bar
        self.set_fill_color(*HDR_FILL)
        self.rect(0, 0, PAGE_W, 19, style="F")

        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*WHITE)
        self.set_xy(MARGIN_L, 4)
        self.cell(120, 7, f"#{index:03d}  {name}", new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_font("Helvetica", "", 9)
        self.cell(CONTENT_W - 120, 7, f"CWID: {cwid}", align="R",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_font("Helvetica", "", 8)
        self.set_text_color(200, 200, 200)
        self.set_x(MARGIN_L)
        self.cell(CONTENT_W, 5, f"{prog}  |  {yr}  |  {enr}  |  GPA: {gpa}",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.ln(1.5)

        for section_key in ("banner_sis", "fafsa_cadaa", "cccapply"):
            self._cur_sec = section_key
            self._draw_section(profile.get(section_key, {}), section_key)

        self._cur_sec = None

    # ── Section rendering ─────────────────────────────────────────────────

    def _section_header(self, section_key: str, continued: bool = False):
        label  = SECTION_LABELS[section_key]
        suffix = " (continued)" if continued else ""
        self.set_fill_color(*HDR_FILL)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 8)
        self.set_x(MARGIN_L)
        self.cell(CONTENT_W, SEC_HDR_H, f"  {label}{suffix}", fill=True,
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(0.5)

    def _draw_section(self, data: dict, section_key: str):
        items = [(k, v) for k, v in data.items() if k != "_meta"]

        self.check_page_break(SEC_HDR_H + ROW_H * 2)
        self._section_header(section_key)

        col_w = LBL_W + VAL_W

        for pair_idx in range(0, len(items), 2):
            self.check_page_break(ROW_H + 0.5)

            y = self.get_y()

            # Alternating light-gray row shading (greyscale only)
            if (pair_idx // 2) % 2 == 0:
                self.set_fill_color(*LIGHT_GRAY)
                self.rect(MARGIN_L, y, CONTENT_W, ROW_H, style="F")

            # Left column
            k0, v0 = items[pair_idx]
            self._field(fmt_key(k0), fmt_val(v0), MARGIN_L, y)

            # Right column
            if pair_idx + 1 < len(items):
                k1, v1 = items[pair_idx + 1]
                self._field(fmt_key(k1), fmt_val(v1), MARGIN_L + col_w + COL_GAP, y)

            self.set_xy(MARGIN_L, y + ROW_H)

        self.ln(2)

    def _field(self, label: str, value: str, x: float, y: float):
        """Render one label+value pair. Label bold dark, value regular black."""
        self.set_xy(x, y)
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*DARK_GRAY)
        self.cell(LBL_W, ROW_H, safe(label), new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_font("Helvetica", "", 7)
        self.set_text_color(*BLACK)
        val = safe(fmt_val(value))
        if len(val) > 40:
            val = val[:38] + "..."
        self.cell(VAL_W, ROW_H, val, new_x=XPos.RIGHT, new_y=YPos.TOP)

    # ── Footer ────────────────────────────────────────────────────────────

    def footer(self):
        self.set_y(-10)
        self.set_font("Helvetica", "I", 6.5)
        self.set_text_color(*MID_GRAY)
        self.cell(
            0, 5,
            safe(f"Golden West College -- Synthetic Test Data -- "
                 f"Page {self.page_no()} | FAKE: Not real student records"),
            align="C",
        )


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    json_files = sorted(STUDENTS_DIR.glob("student_*.json"))
    if not json_files:
        print(f"No student JSON files found in {STUDENTS_DIR}")
        return

    print(f"Found {len(json_files)} profiles -- building PDF...")

    profiles = []
    for path in json_files:
        with open(path, encoding="utf-8") as f:
            profiles.append(json.load(f))

    pdf = StudentPDF(total=len(profiles))
    pdf.cover_page()

    for i, profile in enumerate(profiles, start=1):
        pdf.student_pages(profile, i)
        if i % 10 == 0:
            print(f"  Rendered {i}/{len(profiles)} profiles...")

    pdf.output(str(OUTPUT_PDF))
    size_kb = OUTPUT_PDF.stat().st_size // 1024
    print(f"\nDone!  {OUTPUT_PDF.name}  |  {pdf.page} pages  |  {size_kb} KB")
    print(f"Location: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
