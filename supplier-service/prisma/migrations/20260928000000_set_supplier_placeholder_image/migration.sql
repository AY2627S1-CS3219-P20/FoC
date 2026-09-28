/*
  Sets the supplier thumbnail (imageUrl) to the shared placeholder image
  served at /images/LocationImagePlaceholder.jpg. Every supplier card — on
  both the public Suppliers page and the admin Manage Suppliers page — then
  shows the same default thumbnail.
*/
-- UpdateTable
UPDATE "Supplier" SET "imageUrl" = '/images/LocationImagePlaceholder.jpg';
