import { Router } from 'express'
import { register, login, childLogin, me, changePassword, deleteAccount } from '../controllers/authController'
import { authMiddleware, requireParent } from '../middleware/authMiddleware'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/child-login', childLogin)
router.get('/me', authMiddleware, me)
router.put('/password', authMiddleware, requireParent, changePassword)
router.delete('/account', authMiddleware, requireParent, deleteAccount)

export default router
