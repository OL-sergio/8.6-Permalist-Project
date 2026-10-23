CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL
);

INSERT INTO items (title) VALUES ('Buy milk'), ('Finish homework');
INSERT INTO items (title) VALUES ('Take dog for Walk'), ('On Afternoon');