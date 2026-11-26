const southExit = [26, 171];
const northExit = [26, -212];
const northApproach = [[57, -196], [26, -196], northExit];

// These points are traversed by the collision suite and by the production browser replay.
export const districtRoutes = [
  { id: 'N-A', seed: 2, waypoints: [[-115, 155], [26, 155], southExit] },
  { id: 'N-B', seed: 16, waypoints: [[-65, -196], [57, -196], [57, 155], [26, 155], southExit] },
  { id: 'N-C', seed: 1, waypoints: [[175, -203], [175, 155], [26, 155], southExit] },
  { id: 'N-D', seed: 0, waypoints: [[175, -135], [175, 155], [26, 155], southExit] },
  { id: 'S-A', seed: 3, waypoints: [[-151, 95], [57, 95], ...northApproach] },
  { id: 'S-B', seed: 8, waypoints: [[-83, 155], [57, 155], ...northApproach] },
  { id: 'S-C', seed: 5, waypoints: [[123, 155], [57, 155], ...northApproach] },
  { id: 'S-D', seed: 7, waypoints: [[204, 95], [175, 95], [175, -196], [26, -196], northExit] },
];
