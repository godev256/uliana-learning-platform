// Only new strokes opt in, so existing notebooks keep their original appearance.
export function strokePath(points, smoothing) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0]} l0.01,0`;
  if (smoothing !== 1) return points.map((p, i) => `${i ? "L" : "M"}${p}`).join(" ");
  const path = [`M${points[0]}`];
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1], current = points[i], next = points[i + 1];
    const ax = current[0] - previous[0], ay = current[1] - previous[1];
    const bx = next[0] - current[0], by = next[1] - current[1];
    const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
    const midpoint = [(current[0] + next[0]) / 2, (current[1] + next[1]) / 2];
    // Preserve intentional corners (e.g. roots and angles). Quadratics stay
    // inside the sampled bounds, without spline overshoot or invented loops.
    if (length && (ax * bx + ay * by) / length < .5) path.push(`L${current} L${midpoint}`);
    else path.push(`Q${current} ${midpoint}`);
  }
  path.push(`L${points.at(-1)}`);
  return path.join(" ");
}

export function appendStrokePoints(points, samples) {
  let result = points;
  for (const sample of samples) {
    const last = result.at(-1);
    if (last && last[0] === sample[0] && last[1] === sample[1]) continue;
    if (result === points) result = points.slice();
    result.push(sample);
  }
  return result;
}
