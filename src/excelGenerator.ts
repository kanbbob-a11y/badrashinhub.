import * as XLSX from 'xlsx';
import { Registration, SHIFT_LABELS } from './types';

function mapRows(registrations: Registration[]) {
  return registrations.map((item, index) => ({
    '#': index + 1,
    Name: item.name,
    EmployeeID: item.employeeId,
    Phone: item.phone,
    Shift: SHIFT_LABELS[item.shiftType],
    Day: item.dayKey,
  }));
}

export function generateExcel(dayLabel: string, registrations: Registration[]) {
  const workbook = XLSX.utils.book_new();

  const summaryRows = mapRows(registrations);
  const longRows = mapRows(registrations.filter((item) => item.shiftType === 'long'));
  const nightRows = mapRows(registrations.filter((item) => item.shiftType === 'night'));
  const h24Rows = mapRows(registrations.filter((item) => item.shiftType === '24'));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'All');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(longRows), 'Long');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(nightRows), 'Night');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(h24Rows), '24h');

  XLSX.writeFile(workbook, `roster_${dayLabel.replace(/\s/g, '_')}.xlsx`);
}
