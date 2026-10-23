function clampPetPosition(position, area, dimensions) {
  const halfWidth = dimensions.width / 2;
  const grip = Math.min(36, area.width / 2);
  return {
    x: Math.round(Math.max(area.x - halfWidth + grip, Math.min(area.x + area.width - halfWidth - grip, position.x))),
    y: Math.round(Math.max(area.y, Math.min(area.y + Math.max(0, area.height - dimensions.height), position.y))),
  };
}

module.exports = { clampPetPosition };
