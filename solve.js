// A faster drop-in for csv-reader 1.0.0 (make.fun's reference reader for csv-reader-speed-01):
// run(input) returns exactly csv-reader's {columns, rows, errors} for every input {text, header},
// under the same written broken-row policy. Where the reference reads one character at a time and
// builds each field by concatenation, this reader scans with charCodeAt and takes each field's
// value as one slice of the text, building segments only for the rare field that holds an escaped
// quote, a carriage return inside quotes, or a stray CR outside them.

/** csv-reader 1.0.0's answer for one case's input, computed faster. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const len = text.length;
  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // How a field ended: 0 at a comma (the record goes on), 1 at a line break, 2 at the end of the text.
  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = width > 0 ? new Array(width) : [];
    let nf = 0;
    let lastQuoted = false;
    let ended = 1;
    do {
      let value;
      let init = null; // non-null: the unquoted scan below appends to this value
      let junkCheck = false;
      if (pos < len && text.charCodeAt(pos) === 34) {
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        let i = pos + 1;
        let segStart = i;
        let parts = null;
        let closed = false;
        while (i < len) {
          const c = text.charCodeAt(i);
          if (c === 34) {
            if (i + 1 < len && text.charCodeAt(i + 1) === 34) {
              if (parts === null) parts = [];
              parts.push(text.slice(segStart, i), '"');
              i += 2;
              segStart = i;
              continue;
            }
            closed = true;
            break;
          }
          if (c === 13) {
            // CRLF and a lone CR inside quotes are each one LF.
            if (parts === null) parts = [];
            parts.push(text.slice(segStart, i), '\n');
            line += 1;
            i += i + 1 < len && text.charCodeAt(i + 1) === 10 ? 2 : 1;
            segStart = i;
            continue;
          }
          if (c === 10) line += 1;
          i += 1;
        }
        if (!closed) {
          // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          init = '"';
        } else {
          if (parts === null) {
            value = text.slice(segStart, i);
          } else {
            parts.push(text.slice(segStart, i));
            value = parts.join('');
          }
          pos = i + 1;
          if (pos >= len) {
            ended = 2;
            fields[nf++] = value;
            continue;
          }
          const c = text.charCodeAt(pos);
          if (c === 44) {
            pos += 1;
            ended = 0;
            fields[nf++] = value;
            continue;
          }
          if (c === 10) {
            pos += 1;
            line += 1;
            ended = 1;
            fields[nf++] = value;
            continue;
          }
          if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
            pos += 2;
            line += 1;
            ended = 1;
            fields[nf++] = value;
            continue;
          }
          // What follows the closing quote is appended as it stands, up to the next comma or line break.
          init = value;
          junkCheck = true;
        }
      } else {
        lastQuoted = false;
      }
      // Unquoted scan from pos: up to the next comma or line break; a CR not followed by LF is
      // dropped (stray_cr). Appends to `init` when it is set (quote junk, an unterminated quote).
      {
        let i = pos;
        let segStart = pos;
        let parts = null;
        ended = 2;
        while (i < len) {
          const c = text.charCodeAt(i);
          if (c === 44) {
            ended = 0;
            break;
          }
          if (c === 10) {
            ended = 1;
            break;
          }
          if (c === 13) {
            if (i + 1 < len && text.charCodeAt(i + 1) === 10) {
              ended = 1;
              break;
            }
            errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
            if (parts === null) parts = [];
            parts.push(text.slice(segStart, i));
            i += 1;
            segStart = i;
            continue;
          }
          i += 1;
        }
        let tail;
        if (parts === null) {
          tail = text.slice(segStart, i);
        } else {
          parts.push(text.slice(segStart, i));
          tail = parts.join('');
        }
        if (junkCheck && tail.length > 0) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
        value = init === null ? tail : init + tail;
        if (ended === 0) {
          pos = i + 1;
        } else if (ended === 1) {
          pos = text.charCodeAt(i) === 13 ? i + 2 : i + 1;
          line += 1;
        } else {
          pos = i;
        }
      }
      fields[nf++] = value;
    } while (ended === 0);
    fields.length = nf;

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
