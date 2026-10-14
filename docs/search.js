const normalize = value => String(value).toLowerCase().replace(/[\s_\-–]+/g, '');

// Search only the reviewed catalog, never live external pages or GitHub labels.
export function matchesProject(project, query) {
  const fields = ['title', 'description', 'author', 'categories', 'devices', 'products', 'tags'];
  const haystack = normalize(fields.flatMap(field => project[field] || []).join(' '));
  return String(query).trim().split(/\s+/).filter(Boolean).every(word => haystack.includes(normalize(word)));
}
