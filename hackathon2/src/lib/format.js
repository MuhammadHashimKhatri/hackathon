// Display formatting shared by pages. Dates are "YYYY-MM-DD" strings from the
// database; they are formatted in UTC so the day never shifts with the browser's zone.

const money = new Intl.NumberFormat("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export const formatMoney = (n) => (n === null || n === undefined ? "—" : `Rs ${money.format(n)}`);
export const formatDate = (iso) => (iso ? day.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "—");
export const formatMonth = (iso) => (iso ? month.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "—");
