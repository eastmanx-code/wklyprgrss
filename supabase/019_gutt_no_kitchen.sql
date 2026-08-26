-- The Gutter has no kitchen either.
--
-- Sixth of the front-of-house-only venues, and the first one caught by the
-- scoring rather than in advance: it turned up on the chase list for a heart
-- of house board it had never written, in the first week that half counts. It
-- was never going to write one.
--
-- Nothing structural here — 017 already made this a column precisely because
-- the list moves. This is the list moving.

update venues set houses = '{FOH}'
 where code = 'GUTT';
