export const up = (pgm) => {
  // Ensure we are using timestamptz for precise expiry calculation
  pgm.alterColumn('connections', 'expires_at', {
    type: 'timestamptz',
  });
  pgm.alterColumn('connections', 'reported_at', {
    type: 'timestamptz',
  });
};

export const down = (pgm) => {
  // No reason to go back to less precise types
};
