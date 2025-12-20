/** GET /admin/shows/:id */
router.get("/shows/:id", requireAdminOrOrganiser, async (req, res) => {
