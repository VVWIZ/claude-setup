---
name: read-docx-without-deps
description: "Извлечение текста из .docx только средствами stdlib, когда python-docx и pandoc не установлены, а Read-тул отдаёт файл бинарём. Docx — это ZIP, текст лежит в word/document.xml; структурные теги абзацев и ячеек надо заменить на разделители ДО общего сноса тегов регуляркой, иначе всё склеится. Работает так же для pptx и xlsx. Триггерить при появлении .docx, .pptx, .xlsx без установленных парсеров."
---

# Чтение .docx без сторонних зависимостей

**Extracted:** 2026-07-11
**Context:** Нужно прочитать содержимое Word-файла (.docx), но `python-docx`/`pandoc` не установлены, а встроенный Read-тул не открывает Word.

## Problem
Read-тул отдаёт .docx как бинарь/ошибку. Ставить `python-docx` или `pandoc` не всегда возможно/быстро. Нужен способ достать текст только средствами stdlib.

## Solution
`.docx` — это ZIP-архив; весь текст лежит в `word/document.xml` внутри тегов `<w:t>`. Достаём XML, сначала заменяем **структурные** теги на разделители (иначе абзацы/строки таблиц склеятся), потом сносим оставшиеся теги регуляркой и раскрываем HTML-сущности.

Порядок замен важен: структурные разделители — ДО общего `re.sub('<[^>]+>','')`.

## Example
```python
import zipfile, re, html

def docx_to_text(path: str) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8', 'ignore')
    xml = xml.replace('</w:p>', '\n')          # конец абзаца
    xml = xml.replace('<w:br/>', '\n').replace('<w:br />', '\n')
    xml = xml.replace('<w:tab/>', '\t').replace('<w:tab />', '\t')
    xml = xml.replace('</w:tr>', '\n').replace('</w:tc>', ' | ')  # строки/ячейки таблиц
    text = re.sub(r'<[^>]+>', '', xml)         # снести остальные теги
    text = html.unescape(text)
    return re.sub(r'\n[ \t]*\n[ \t]*\n+', '\n\n', text)  # схлопнуть пустые строки
```
Затем записать в .txt в scratchpad и читать Read-тулом постранично.

## When to Use
- Появился .docx, а `python-docx`/`pandoc` нет и ставить не хочется.
- Нужно быстро извлечь текст (не форматирование/картинки) для анализа.
- Аналогично: `.pptx` → `ppt/slides/slide*.xml`, `.xlsx` → `xl/sharedStrings.xml` + `xl/worksheets/sheet*.xml`.

## Ограничения
- Теряется форматирование, изображения, точные границы таблиц (только грубый `|`-разделитель).
- Для сканов/изображений внутри — не поможет (нужен OCR).
