-- Table: item_events (time‑series metrics for trends)
CREATE TABLE item_events (
  time      TIMESTAMPTZ NOT NULL,
  category  TEXT         NOT NULL,
  metric    TEXT         NOT NULL,
  value     DOUBLE PRECISION,
  PRIMARY KEY(time, category, metric)
); 