-- Table: categories (subscribeable topics)
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- Table: item_tags (many‑to‑many for tagging)
CREATE TABLE item_tags (
  item_id UUID REFERENCES normalized_items(id),
  cat_id  INT REFERENCES categories(id),
  PRIMARY KEY(item_id, cat_id)
);

-- Table: watches (user subscriptions & filters)
CREATE TABLE watches (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,       
  category_id INT REFERENCES categories(id),
  filter      JSONB,               
  created_at  TIMESTAMPTZ DEFAULT now()
); 