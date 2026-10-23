CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL
);

INSERT INTO items (title) VALUES ('Buy milk'), ('Finish homework'), ('Take dog for Walk');


ALTER TABLE items
ADD date VARCHAR(55); 

SELECT * FROM items


CREATE TABLE users (
  id SERIAL PRIMARY KEY UNIQUE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(55) NOT NULL   
);

CREATE TABLE day (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  date VARCHAR (55) NOT NULL,
  id_user INTEGER REFERENCES users(id)
);

CREATE TABLE weeks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  date VARCHAR (55) NOT NULL,
  id_user INTEGER REFERENCES users(id)
);


CREATE TABLE months (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  date VARCHAR (55) NOT NULL,
  id_user INTEGER REFERENCES users(id)
);

INSERT INTO users (name, color) VALUES ('Filipe', 'blue'), ('Carlos', 'green');

INSERT INTO day (title, date, id_user) 
VALUES ('Passeio do cão', '25/06/2026', '2' ), 
('Fazer compras', '25/06/2026', '1' );


INSERT INTO months (title, date, id_user) 
VALUES ('Pagar Seguro carro', '24/06/2026', '2' ), 
('Pagar imposto de selo', '22/06/2026', '1' );

INSERT INTO weeks (title, date, id_user) 
VALUES ('ver impostos pagar', '26/06/2026', '2' ), 
('ver comida de cão', '30/06/2026', '1' );

SELECT * FROM users ;
SELECT * FROM day ;
SELECT * FROM weeks ;
SELECT * FROM months ;

SELECT title FROM day JOIN users ON users.id = id_user WHERE id_user = 1;
SELECT title FROM weeks JOIN users ON users.id = id_user WHERE id_user = 1;
SELECT title FROM months JOIN users ON users.id = id_user WHERE id_user = 1;


SELECT  day.id ,title, date, id_user FROM day JOIN users ON users.id = id_user WHERE id_user = 1;
SELECT  months.id ,title, date, id_user FROM months JOIN users ON users.id = id_user WHERE id_user = 1;
SELECT  weeks.id ,title, date, id_user FROM weeks JOIN users ON users.id = id_user WHERE id_user = 1;

DELETE FROM months WHERE id = 3

DELETE FROM users WHERE id = 90;
DELETE FROM users WHERE id > 3;
