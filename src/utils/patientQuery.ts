const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parsePaging = (query: Record<string, any>) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
  return { page, limit };
};

export const buildPatientFilter = (query: Record<string, any>) => {
  const { search, condition, status, gender, from, to } = query;
  const filter: Record<string, any> = {};

  if (search) filter.$text = { $search: String(search) };
  if (condition) filter.condition = new RegExp(escapeRegex(String(condition)), "i");
  if (status) filter.status = String(status);
  if (gender) filter.gender = String(gender);

  if (from || to) {
    filter.admittedAt = {};
    if (from) filter.admittedAt.$gte = new Date(String(from));
    if (to) {
      const end = new Date(String(to));
      end.setHours(23, 59, 59, 999); // include the whole "to" day
      filter.admittedAt.$lte = end;
    }
  }
  return filter;
};