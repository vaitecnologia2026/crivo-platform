import 'reflect-metadata';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { type Express } from 'express';
import { AppModule } from '../src/app.module';
import { applyAppConfig } from '../src/setup';

// Permite à função rodar até 60s — geração do Relatório Preliminar via IA leva
// mais que o padrão (~10s) da Vercel. (Plano permite até 60s; Pro até 300s.)
export const config = { maxDuration: 60 };

// Cacheia a instância Nest entre invocações da mesma função serverless (warm start).
let cached: Express | null = null;

async function getServer(): Promise<Express> {
  if (cached) return cached;
  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { logger: ['error', 'warn'] });
  applyAppConfig(app);
  await app.init();
  cached = expressApp;
  return cached;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const server = await getServer();
  server(req as never, res as never);
}
