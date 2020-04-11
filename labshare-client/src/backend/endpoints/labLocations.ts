import express from 'express';
import { getMarkerLocations } from '../database/database';

export async function labLocations(
  req: express.Request,
  res: express.Response
) {
  res.send({
    success: true,
    data: await getMarkerLocations(),
  });
}
