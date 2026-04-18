import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';

export function initSocket(io: Server): void {
  // Auth middleware socket
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Token tidak ditemukan'));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Token tidak valid'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: JwtPayload = socket.data.user;
    console.log(`[Socket] Connected: ${user.sub} (${user.role})`);

    // Subscribe ke room
    socket.on('subscribe:baby', (babyId: string) => {
      // Validasi: parent hanya bisa subscribe bayi miliknya
      if (user.role === 'parent' && user.babyId !== babyId) return;
      socket.join(`baby:${babyId}`);
      console.log(`[Socket] ${user.sub} joined baby:${babyId}`);
    });

    socket.on('subscribe:unit', (unitId: string) => {
      if (user.role !== 'nurse') return;
      socket.join(`unit:${unitId}`);
      console.log(`[Socket] ${user.sub} joined unit:${unitId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${user.sub}`);
    });
  });
}

// Helper: broadcast status bayi ke semua subscriber
export function broadcastBabyStatus(io: Server, babyStatus: any): void {
  io.to(`baby:${babyStatus.babyId}`).emit('baby:status-update', babyStatus);

  if (babyStatus.unitId) {
    io.to(`unit:${babyStatus.unitId}`).emit('baby:status-update', babyStatus);
  }
}

export function broadcastAlert(io: Server, alert: any): void {
  io.to(`baby:${alert.babyId}`).emit('baby:alert', alert);

  if (alert.unitId) {
    io.to(`unit:${alert.unitId}`).emit('baby:alert', alert);
  }
}