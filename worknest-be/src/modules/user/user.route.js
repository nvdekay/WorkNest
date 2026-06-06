const express = require('express');
const userController = require('./user.controller');
const userValidation = require('./user.validation');
const validate = require('../../middlewares/validate.middleware');
const { auth, requireRole } = require('../../middlewares/auth.middleware');

const router = express.Router();

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: User management
 */

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users (paginated)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/User' }
 *                         total: { type: integer }
 *                         page: { type: integer }
 *                         limit: { type: integer }
 *   post:
 *     tags: [Users]
 *     summary: Create a user (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [user, admin] }
 *     responses:
 *       201: { description: Created }
 *       403: { description: Forbidden }
 */
router
  .route('/')
  .get(auth, validate(userValidation.list), userController.list)
  .post(auth, requireRole('admin'), validate(userValidation.create), userController.create);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Users]
 *     summary: Update user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [user, admin] }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Users]
 *     summary: Delete user (admin only)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router
  .route('/:id')
  .get(auth, validate(userValidation.byId), userController.getById)
  .patch(auth, validate(userValidation.update), userController.update)
  .delete(auth, requireRole('admin'), validate(userValidation.byId), userController.remove);

module.exports = router;
