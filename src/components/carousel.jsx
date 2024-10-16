import { Image } from "astro:assets";

import imageList from "../assets/photos";

import ExifReader from "exifreader";

const slides = await Promise.all(
  imageList.map(async (image) => {
    let filepath = image.src.replace("@fs/", "").split("?").shift();
    let tags = await ExifReader.load(filepath);

    return {
      image: image,
      caption: tags["title"].description,
    };
  })
);

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export default function Carousel() {
return (
<div>
  <Swiper
    modules={[Navigation, Pagination]}
    spaceBetween={50}
    slidesPerView={1}
    navigation
    pagination={{ clickable: true }}
  >
    {
      slides.map(({ image, caption }) => (
        <SwiperSlide></SwiperSlide>
          <Image src={image} alt={caption} width={800} height={600} />
        </SwiperSlide>
      ))
    }
  </Swiper>

  <style>
    .swiper {
      width: 100%;
      height: 400px; /* Adjust as needed */
    }
    .swiper-slide img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  </style>
</div>
)
}