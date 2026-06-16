import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "曲奇堡的小家",
    short_name: "曲奇堡",
    description: "家庭博客、待办菜单、点餐、库存和买菜清单。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5ef",
    theme_color: "#f8f5ef",
    icons: [
      {
        src: "/brand/cookiehome-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/cookiehome-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/cookiehome-apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
