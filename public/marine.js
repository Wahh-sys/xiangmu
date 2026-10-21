/* Offshore geometry checks use the same Mercator projection as the visible map. */
(() => {
  'use strict';
  const radians = Math.PI / 180;
  const project = ([lon, lat]) => [lon, Math.log(Math.tan(Math.PI / 4 + lat * radians / 2)) / radians];
  const unproject = ([x, y]) => [x, (2 * Math.atan(Math.exp(y * radians)) - Math.PI / 2) / radians];
  const bounds = points => points.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  const region = bounds([[94, -3], [148, 46]].map(project));
  const polygons = [];
  for (const feature of window.WORLD_GEO?.features || []) {
    const geometry = feature.geometry;
    const items = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
    for (const item of items) {
      const rings = item.map(r => r.map(project));
      const box = bounds(rings[0]);
      if (overlaps(box, region)) polygons.push({rings, box, name: feature.properties?.name || 'land'});
    }
  }
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  function onSegment(a, b, p) {
    return Math.abs(cross(a, b, p)) < 1e-9 && p[0] >= Math.min(a[0], b[0]) - 1e-9 && p[0] <= Math.max(a[0], b[0]) + 1e-9 && p[1] >= Math.min(a[1], b[1]) - 1e-9 && p[1] <= Math.max(a[1], b[1]) + 1e-9;
  }
  function intersects(a, b, c, d) {
    if (!overlaps(bounds([a, b]), bounds([c, d]))) return false;
    const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
    return (ac * ad < 0 && ca * cb < 0) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
  }
  function inRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (onSegment(a, b, point)) return true;
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function landAtProjected(p) {
    return polygons.find(poly => overlaps(poly.box, [p[0], p[1], p[0], p[1]]) && inRing(p, poly.rings[0]) && !poly.rings.slice(1).some(r => inRing(p, r)));
  }
  function segmentCollision(a, b) {
    const pa = project(a), pb = project(b), box = bounds([pa, pb]);
    for (const poly of polygons) {
      if (!overlaps(box, poly.box)) continue;
      if (landAtProjected(pa) === poly || landAtProjected(pb) === poly) return poly.name;
      for (const ring of poly.rings) for (let i = 1; i < ring.length; i++) if (intersects(pa, pb, ring[i - 1], ring[i])) return poly.name;
    }
    return null;
  }
  function validate(path) {
    if (!polygons.length) return {ok: false, reason: '缺少离线岸线数据'};
    for (let i = 1; i < path.length; i++) {
      const land = segmentCollision(path[i - 1], path[i]);
      if (land) return {ok: false, segment: i - 1, land, from: path[i - 1], to: path[i]};
    }
    return {ok: true, segments: path.length - 1};
  }
  function densify(path, maxDegrees = .12) {
    const result = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const a = project(path[i - 1]), b = project(path[i]);
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxDegrees));
      for (let j = 1; j <= steps; j++) result.push(unproject([a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps]));
    }
    return result;
  }
  window.Marine = {validate, densify, isLand: p => Boolean(landAtProjected(project(p))), segmentCollision};
})();
