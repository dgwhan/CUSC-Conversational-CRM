import React from 'react';
import { MainLayout, type MainLayoutProps } from '../layouts/MainLayout.js';

export type AppLayoutProps = MainLayoutProps;

/**
 * AppLayout kết nối MainLayout để duy trì tương thích.
 */
export const AppLayout: React.FC<AppLayoutProps> = (props) => {
  return <MainLayout {...props} />;
};
