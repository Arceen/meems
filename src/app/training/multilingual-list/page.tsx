"use client";

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';
import { saveGameResult } from '@/lib/firebase';

type GameState = 'setup' | 'memorize' | 'recall' | 'result';
type Language = 'japanese' | 'russian' | 'swahili' | 'mandarin' | 'arabic' | 'korean';

interface WordPair {
    foreign: string;
    romanization: string;
    english: string;
    language: Language;
}

const LANGUAGE_DATA: { [key in Language]: WordPair[] } = {
    japanese: [
        { foreign: '靴下', romanization: 'Kutsushita', english: 'Sock', language: 'japanese' },
        { foreign: '時計', romanization: 'Tokei', english: 'Clock', language: 'japanese' },
        { foreign: '机', romanization: 'Tsukue', english: 'Desk', language: 'japanese' },
        { foreign: '窓', romanization: 'Mado', english: 'Window', language: 'japanese' },
        { foreign: '鉛筆', romanization: 'Enpitsu', english: 'Pencil', language: 'japanese' },
        { foreign: '本', romanization: 'Hon', english: 'Book', language: 'japanese' },
        { foreign: '椅子', romanization: 'Isu', english: 'Chair', language: 'japanese' },
        { foreign: '猫', romanization: 'Neko', english: 'Cat', language: 'japanese' },
        { foreign: '犬', romanization: 'Inu', english: 'Dog', language: 'japanese' },
        { foreign: '水', romanization: 'Mizu', english: 'Water', language: 'japanese' },
        { foreign: '食べ物', romanization: 'Tabemono', english: 'Food', language: 'japanese' },
        { foreign: '車', romanization: 'Kuruma', english: 'Car', language: 'japanese' },
        { foreign: '家', romanization: 'Ie', english: 'House', language: 'japanese' },
        { foreign: '学校', romanization: 'Gakkou', english: 'School', language: 'japanese' },
        { foreign: '友達', romanization: 'Tomodachi', english: 'Friend', language: 'japanese' },
        { foreign: '花', romanization: 'Hana', english: 'Flower', language: 'japanese' },
        { foreign: '木', romanization: 'Ki', english: 'Tree', language: 'japanese' },
        { foreign: '空', romanization: 'Sora', english: 'Sky', language: 'japanese' },
        { foreign: '海', romanization: 'Umi', english: 'Sea', language: 'japanese' },
        { foreign: '山', romanization: 'Yama', english: 'Mountain', language: 'japanese' },
        { foreign: '川', romanization: 'Kawa', english: 'River', language: 'japanese' },
        { foreign: '太陽', romanization: 'Taiyou', english: 'Sun', language: 'japanese' },
        { foreign: '月', romanization: 'Tsuki', english: 'Moon', language: 'japanese' },
        { foreign: '星', romanization: 'Hoshi', english: 'Star', language: 'japanese' },
        { foreign: '雨', romanization: 'Ame', english: 'Rain', language: 'japanese' },
        { foreign: '雪', romanization: 'Yuki', english: 'Snow', language: 'japanese' },
        { foreign: '風', romanization: 'Kaze', english: 'Wind', language: 'japanese' },
        { foreign: '火', romanization: 'Hi', english: 'Fire', language: 'japanese' },
        { foreign: '石', romanization: 'Ishi', english: 'Stone', language: 'japanese' },
        { foreign: '紙', romanization: 'Kami', english: 'Paper', language: 'japanese' },
        { foreign: '鍵', romanization: 'Kagi', english: 'Key', language: 'japanese' },
        { foreign: '扉', romanization: 'Tobira', english: 'Door', language: 'japanese' },
        { foreign: '道', romanization: 'Michi', english: 'Road', language: 'japanese' },
        { foreign: '橋', romanization: 'Hashi', english: 'Bridge', language: 'japanese' },
        { foreign: '電話', romanization: 'Denwa', english: 'Phone', language: 'japanese' },
        { foreign: 'コンピューター', romanization: 'Konpyuutaa', english: 'Computer', language: 'japanese' },
        { foreign: '音楽', romanization: 'Ongaku', english: 'Music', language: 'japanese' },
        { foreign: '映画', romanization: 'Eiga', english: 'Movie', language: 'japanese' },
        { foreign: '写真', romanization: 'Shashin', english: 'Photo', language: 'japanese' },
        { foreign: '絵', romanization: 'E', english: 'Picture', language: 'japanese' },
        { foreign: '色', romanization: 'Iro', english: 'Color', language: 'japanese' },
        { foreign: '赤', romanization: 'Aka', english: 'Red', language: 'japanese' },
        { foreign: '青', romanization: 'Ao', english: 'Blue', language: 'japanese' },
        { foreign: '緑', romanization: 'Midori', english: 'Green', language: 'japanese' },
        { foreign: '黒', romanization: 'Kuro', english: 'Black', language: 'japanese' },
        { foreign: '白', romanization: 'Shiro', english: 'White', language: 'japanese' },
        { foreign: '黄色', romanization: 'Kiiro', english: 'Yellow', language: 'japanese' },
        { foreign: '朝', romanization: 'Asa', english: 'Morning', language: 'japanese' },
        { foreign: '夜', romanization: 'Yoru', english: 'Night', language: 'japanese' },
        { foreign: '時間', romanization: 'Jikan', english: 'Time', language: 'japanese' },
    ],
    russian: [
        { foreign: 'Собака', romanization: 'Sobaka', english: 'Dog', language: 'russian' },
        { foreign: 'Кошка', romanization: 'Koshka', english: 'Cat', language: 'russian' },
        { foreign: 'Дом', romanization: 'Dom', english: 'House', language: 'russian' },
        { foreign: 'Вода', romanization: 'Voda', english: 'Water', language: 'russian' },
        { foreign: 'Хлеб', romanization: 'Khleb', english: 'Bread', language: 'russian' },
        { foreign: 'Книга', romanization: 'Kniga', english: 'Book', language: 'russian' },
        { foreign: 'Стол', romanization: 'Stol', english: 'Table', language: 'russian' },
        { foreign: 'Стул', romanization: 'Stul', english: 'Chair', language: 'russian' },
        { foreign: 'Окно', romanization: 'Okno', english: 'Window', language: 'russian' },
        { foreign: 'Дверь', romanization: 'Dver', english: 'Door', language: 'russian' },
        { foreign: 'Машина', romanization: 'Mashina', english: 'Car', language: 'russian' },
        { foreign: 'Дерево', romanization: 'Derevo', english: 'Tree', language: 'russian' },
        { foreign: 'Цветок', romanization: 'Tsvetok', english: 'Flower', language: 'russian' },
        { foreign: 'Небо', romanization: 'Nebo', english: 'Sky', language: 'russian' },
        { foreign: 'Море', romanization: 'More', english: 'Sea', language: 'russian' },
        { foreign: 'Гора', romanization: 'Gora', english: 'Mountain', language: 'russian' },
        { foreign: 'Река', romanization: 'Reka', english: 'River', language: 'russian' },
        { foreign: 'Солнце', romanization: 'Solntse', english: 'Sun', language: 'russian' },
        { foreign: 'Луна', romanization: 'Luna', english: 'Moon', language: 'russian' },
        { foreign: 'Звезда', romanization: 'Zvezda', english: 'Star', language: 'russian' },
        { foreign: 'Дождь', romanization: 'Dozhd', english: 'Rain', language: 'russian' },
        { foreign: 'Снег', romanization: 'Sneg', english: 'Snow', language: 'russian' },
        { foreign: 'Ветер', romanization: 'Veter', english: 'Wind', language: 'russian' },
        { foreign: 'Огонь', romanization: 'Ogon', english: 'Fire', language: 'russian' },
        { foreign: 'Камень', romanization: 'Kamen', english: 'Stone', language: 'russian' },
        { foreign: 'Бумага', romanization: 'Bumaga', english: 'Paper', language: 'russian' },
        { foreign: 'Ключ', romanization: 'Klyuch', english: 'Key', language: 'russian' },
        { foreign: 'Дорога', romanization: 'Doroga', english: 'Road', language: 'russian' },
        { foreign: 'Мост', romanization: 'Most', english: 'Bridge', language: 'russian' },
        { foreign: 'Телефон', romanization: 'Telefon', english: 'Phone', language: 'russian' },
        { foreign: 'Музыка', romanization: 'Muzyka', english: 'Music', language: 'russian' },
        { foreign: 'Фильм', romanization: 'Film', english: 'Movie', language: 'russian' },
        { foreign: 'Фото', romanization: 'Foto', english: 'Photo', language: 'russian' },
        { foreign: 'Картина', romanization: 'Kartina', english: 'Picture', language: 'russian' },
        { foreign: 'Цвет', romanization: 'Tsvet', english: 'Color', language: 'russian' },
        { foreign: 'Красный', romanization: 'Krasny', english: 'Red', language: 'russian' },
        { foreign: 'Синий', romanization: 'Siniy', english: 'Blue', language: 'russian' },
        { foreign: 'Зелёный', romanization: 'Zelyony', english: 'Green', language: 'russian' },
        { foreign: 'Чёрный', romanization: 'Chyorny', english: 'Black', language: 'russian' },
        { foreign: 'Белый', romanization: 'Bely', english: 'White', language: 'russian' },
        { foreign: 'Жёлтый', romanization: 'Zholty', english: 'Yellow', language: 'russian' },
        { foreign: 'Утро', romanization: 'Utro', english: 'Morning', language: 'russian' },
        { foreign: 'Ночь', romanization: 'Noch', english: 'Night', language: 'russian' },
        { foreign: 'Время', romanization: 'Vremya', english: 'Time', language: 'russian' },
        { foreign: 'Школа', romanization: 'Shkola', english: 'School', language: 'russian' },
        { foreign: 'Друг', romanization: 'Drug', english: 'Friend', language: 'russian' },
        { foreign: 'Еда', romanization: 'Eda', english: 'Food', language: 'russian' },
        { foreign: 'Карандаш', romanization: 'Karandash', english: 'Pencil', language: 'russian' },
        { foreign: 'Часы', romanization: 'Chasy', english: 'Clock', language: 'russian' },
        { foreign: 'Носок', romanization: 'Nosok', english: 'Sock', language: 'russian' },
    ],
    swahili: [
        { foreign: 'Mbwa', romanization: 'Mbwa', english: 'Dog', language: 'swahili' },
        { foreign: 'Paka', romanization: 'Paka', english: 'Cat', language: 'swahili' },
        { foreign: 'Nyumba', romanization: 'Nyumba', english: 'House', language: 'swahili' },
        { foreign: 'Maji', romanization: 'Maji', english: 'Water', language: 'swahili' },
        { foreign: 'Mkate', romanization: 'Mkate', english: 'Bread', language: 'swahili' },
        { foreign: 'Kitabu', romanization: 'Kitabu', english: 'Book', language: 'swahili' },
        { foreign: 'Meza', romanization: 'Meza', english: 'Table', language: 'swahili' },
        { foreign: 'Kiti', romanization: 'Kiti', english: 'Chair', language: 'swahili' },
        { foreign: 'Dirisha', romanization: 'Dirisha', english: 'Window', language: 'swahili' },
        { foreign: 'Mlango', romanization: 'Mlango', english: 'Door', language: 'swahili' },
        { foreign: 'Gari', romanization: 'Gari', english: 'Car', language: 'swahili' },
        { foreign: 'Mti', romanization: 'Mti', english: 'Tree', language: 'swahili' },
        { foreign: 'Ua', romanization: 'Ua', english: 'Flower', language: 'swahili' },
        { foreign: 'Anga', romanization: 'Anga', english: 'Sky', language: 'swahili' },
        { foreign: 'Bahari', romanization: 'Bahari', english: 'Sea', language: 'swahili' },
        { foreign: 'Mlima', romanization: 'Mlima', english: 'Mountain', language: 'swahili' },
        { foreign: 'Mto', romanization: 'Mto', english: 'River', language: 'swahili' },
        { foreign: 'Jua', romanization: 'Jua', english: 'Sun', language: 'swahili' },
        { foreign: 'Mwezi', romanization: 'Mwezi', english: 'Moon', language: 'swahili' },
        { foreign: 'Nyota', romanization: 'Nyota', english: 'Star', language: 'swahili' },
        { foreign: 'Mvua', romanization: 'Mvua', english: 'Rain', language: 'swahili' },
        { foreign: 'Theluji', romanization: 'Theluji', english: 'Snow', language: 'swahili' },
        { foreign: 'Upepo', romanization: 'Upepo', english: 'Wind', language: 'swahili' },
        { foreign: 'Moto', romanization: 'Moto', english: 'Fire', language: 'swahili' },
        { foreign: 'Jiwe', romanization: 'Jiwe', english: 'Stone', language: 'swahili' },
        { foreign: 'Karatasi', romanization: 'Karatasi', english: 'Paper', language: 'swahili' },
        { foreign: 'Ufunguo', romanization: 'Ufunguo', english: 'Key', language: 'swahili' },
        { foreign: 'Barabara', romanization: 'Barabara', english: 'Road', language: 'swahili' },
        { foreign: 'Daraja', romanization: 'Daraja', english: 'Bridge', language: 'swahili' },
        { foreign: 'Simu', romanization: 'Simu', english: 'Phone', language: 'swahili' },
        { foreign: 'Muziki', romanization: 'Muziki', english: 'Music', language: 'swahili' },
        { foreign: 'Filamu', romanization: 'Filamu', english: 'Movie', language: 'swahili' },
        { foreign: 'Picha', romanization: 'Picha', english: 'Photo', language: 'swahili' },
        { foreign: 'Mchoro', romanization: 'Mchoro', english: 'Picture', language: 'swahili' },
        { foreign: 'Rangi', romanization: 'Rangi', english: 'Color', language: 'swahili' },
        { foreign: 'Nyekundu', romanization: 'Nyekundu', english: 'Red', language: 'swahili' },
        { foreign: 'Bluu', romanization: 'Bluu', english: 'Blue', language: 'swahili' },
        { foreign: 'Kijani', romanization: 'Kijani', english: 'Green', language: 'swahili' },
        { foreign: 'Nyeusi', romanization: 'Nyeusi', english: 'Black', language: 'swahili' },
        { foreign: 'Nyeupe', romanization: 'Nyeupe', english: 'White', language: 'swahili' },
        { foreign: 'Njano', romanization: 'Njano', english: 'Yellow', language: 'swahili' },
        { foreign: 'Asubuhi', romanization: 'Asubuhi', english: 'Morning', language: 'swahili' },
        { foreign: 'Usiku', romanization: 'Usiku', english: 'Night', language: 'swahili' },
        { foreign: 'Wakati', romanization: 'Wakati', english: 'Time', language: 'swahili' },
        { foreign: 'Shule', romanization: 'Shule', english: 'School', language: 'swahili' },
        { foreign: 'Rafiki', romanization: 'Rafiki', english: 'Friend', language: 'swahili' },
        { foreign: 'Chakula', romanization: 'Chakula', english: 'Food', language: 'swahili' },
        { foreign: 'Kalamu', romanization: 'Kalamu', english: 'Pencil', language: 'swahili' },
        { foreign: 'Saa', romanization: 'Saa', english: 'Clock', language: 'swahili' },
        { foreign: 'Soksi', romanization: 'Soksi', english: 'Sock', language: 'swahili' },
    ],
    mandarin: [
        { foreign: '狗', romanization: 'Gǒu', english: 'Dog', language: 'mandarin' },
        { foreign: '猫', romanization: 'Māo', english: 'Cat', language: 'mandarin' },
        { foreign: '房子', romanization: 'Fángzi', english: 'House', language: 'mandarin' },
        { foreign: '水', romanization: 'Shuǐ', english: 'Water', language: 'mandarin' },
        { foreign: '面包', romanization: 'Miànbāo', english: 'Bread', language: 'mandarin' },
        { foreign: '书', romanization: 'Shū', english: 'Book', language: 'mandarin' },
        { foreign: '桌子', romanization: 'Zhuōzi', english: 'Table', language: 'mandarin' },
        { foreign: '椅子', romanization: 'Yǐzi', english: 'Chair', language: 'mandarin' },
        { foreign: '窗户', romanization: 'Chuānghù', english: 'Window', language: 'mandarin' },
        { foreign: '门', romanization: 'Mén', english: 'Door', language: 'mandarin' },
        { foreign: '车', romanization: 'Chē', english: 'Car', language: 'mandarin' },
        { foreign: '树', romanization: 'Shù', english: 'Tree', language: 'mandarin' },
        { foreign: '花', romanization: 'Huā', english: 'Flower', language: 'mandarin' },
        { foreign: '天空', romanization: 'Tiānkōng', english: 'Sky', language: 'mandarin' },
        { foreign: '海', romanization: 'Hǎi', english: 'Sea', language: 'mandarin' },
        { foreign: '山', romanization: 'Shān', english: 'Mountain', language: 'mandarin' },
        { foreign: '河', romanization: 'Hé', english: 'River', language: 'mandarin' },
        { foreign: '太阳', romanization: 'Tàiyáng', english: 'Sun', language: 'mandarin' },
        { foreign: '月亮', romanization: 'Yuèliàng', english: 'Moon', language: 'mandarin' },
        { foreign: '星星', romanization: 'Xīngxing', english: 'Star', language: 'mandarin' },
        { foreign: '雨', romanization: 'Yǔ', english: 'Rain', language: 'mandarin' },
        { foreign: '雪', romanization: 'Xuě', english: 'Snow', language: 'mandarin' },
        { foreign: '风', romanization: 'Fēng', english: 'Wind', language: 'mandarin' },
        { foreign: '火', romanization: 'Huǒ', english: 'Fire', language: 'mandarin' },
        { foreign: '石头', romanization: 'Shítou', english: 'Stone', language: 'mandarin' },
        { foreign: '纸', romanization: 'Zhǐ', english: 'Paper', language: 'mandarin' },
        { foreign: '钥匙', romanization: 'Yàoshi', english: 'Key', language: 'mandarin' },
        { foreign: '路', romanization: 'Lù', english: 'Road', language: 'mandarin' },
        { foreign: '桥', romanization: 'Qiáo', english: 'Bridge', language: 'mandarin' },
        { foreign: '电话', romanization: 'Diànhuà', english: 'Phone', language: 'mandarin' },
        { foreign: '音乐', romanization: 'Yīnyuè', english: 'Music', language: 'mandarin' },
        { foreign: '电影', romanization: 'Diànyǐng', english: 'Movie', language: 'mandarin' },
        { foreign: '照片', romanization: 'Zhàopiàn', english: 'Photo', language: 'mandarin' },
        { foreign: '画', romanization: 'Huà', english: 'Picture', language: 'mandarin' },
        { foreign: '颜色', romanization: 'Yánsè', english: 'Color', language: 'mandarin' },
        { foreign: '红色', romanization: 'Hóngsè', english: 'Red', language: 'mandarin' },
        { foreign: '蓝色', romanization: 'Lánsè', english: 'Blue', language: 'mandarin' },
        { foreign: '绿色', romanization: 'Lǜsè', english: 'Green', language: 'mandarin' },
        { foreign: '黑色', romanization: 'Hēisè', english: 'Black', language: 'mandarin' },
        { foreign: '白色', romanization: 'Báisè', english: 'White', language: 'mandarin' },
        { foreign: '黄色', romanization: 'Huángsè', english: 'Yellow', language: 'mandarin' },
        { foreign: '早上', romanization: 'Zǎoshang', english: 'Morning', language: 'mandarin' },
        { foreign: '晚上', romanization: 'Wǎnshang', english: 'Night', language: 'mandarin' },
        { foreign: '时间', romanization: 'Shíjiān', english: 'Time', language: 'mandarin' },
        { foreign: '学校', romanization: 'Xuéxiào', english: 'School', language: 'mandarin' },
        { foreign: '朋友', romanization: 'Péngyou', english: 'Friend', language: 'mandarin' },
        { foreign: '食物', romanization: 'Shíwù', english: 'Food', language: 'mandarin' },
        { foreign: '铅笔', romanization: 'Qiānbǐ', english: 'Pencil', language: 'mandarin' },
        { foreign: '钟', romanization: 'Zhōng', english: 'Clock', language: 'mandarin' },
        { foreign: '袜子', romanization: 'Wàzi', english: 'Sock', language: 'mandarin' },
    ],
    arabic: [
        { foreign: 'كلب', romanization: 'Kalb', english: 'Dog', language: 'arabic' },
        { foreign: 'قطة', romanization: 'Qitta', english: 'Cat', language: 'arabic' },
        { foreign: 'بيت', romanization: 'Bayt', english: 'House', language: 'arabic' },
        { foreign: 'ماء', romanization: 'Maa', english: 'Water', language: 'arabic' },
        { foreign: 'خبز', romanization: 'Khubz', english: 'Bread', language: 'arabic' },
        { foreign: 'كتاب', romanization: 'Kitaab', english: 'Book', language: 'arabic' },
        { foreign: 'طاولة', romanization: 'Taawila', english: 'Table', language: 'arabic' },
        { foreign: 'كرسي', romanization: 'Kursi', english: 'Chair', language: 'arabic' },
        { foreign: 'نافذة', romanization: 'Naafidha', english: 'Window', language: 'arabic' },
        { foreign: 'باب', romanization: 'Baab', english: 'Door', language: 'arabic' },
        { foreign: 'سيارة', romanization: 'Sayyaara', english: 'Car', language: 'arabic' },
        { foreign: 'شجرة', romanization: 'Shajara', english: 'Tree', language: 'arabic' },
        { foreign: 'زهرة', romanization: 'Zahra', english: 'Flower', language: 'arabic' },
        { foreign: 'سماء', romanization: 'Samaa', english: 'Sky', language: 'arabic' },
        { foreign: 'بحر', romanization: 'Bahr', english: 'Sea', language: 'arabic' },
        { foreign: 'جبل', romanization: 'Jabal', english: 'Mountain', language: 'arabic' },
        { foreign: 'نهر', romanization: 'Nahr', english: 'River', language: 'arabic' },
        { foreign: 'شمس', romanization: 'Shams', english: 'Sun', language: 'arabic' },
        { foreign: 'قمر', romanization: 'Qamar', english: 'Moon', language: 'arabic' },
        { foreign: 'نجمة', romanization: 'Najma', english: 'Star', language: 'arabic' },
        { foreign: 'مطر', romanization: 'Matar', english: 'Rain', language: 'arabic' },
        { foreign: 'ثلج', romanization: 'Thalj', english: 'Snow', language: 'arabic' },
        { foreign: 'ريح', romanization: 'Reeh', english: 'Wind', language: 'arabic' },
        { foreign: 'نار', romanization: 'Naar', english: 'Fire', language: 'arabic' },
        { foreign: 'حجر', romanization: 'Hajar', english: 'Stone', language: 'arabic' },
        { foreign: 'ورق', romanization: 'Waraq', english: 'Paper', language: 'arabic' },
        { foreign: 'مفتاح', romanization: 'Miftaah', english: 'Key', language: 'arabic' },
        { foreign: 'طريق', romanization: 'Tareeq', english: 'Road', language: 'arabic' },
        { foreign: 'جسر', romanization: 'Jisr', english: 'Bridge', language: 'arabic' },
        { foreign: 'هاتف', romanization: 'Haatif', english: 'Phone', language: 'arabic' },
        { foreign: 'موسيقى', romanization: 'Musiqa', english: 'Music', language: 'arabic' },
        { foreign: 'فيلم', romanization: 'Film', english: 'Movie', language: 'arabic' },
        { foreign: 'صورة', romanization: 'Soora', english: 'Photo', language: 'arabic' },
        { foreign: 'رسم', romanization: 'Rasm', english: 'Picture', language: 'arabic' },
        { foreign: 'لون', romanization: 'Lawn', english: 'Color', language: 'arabic' },
        { foreign: 'أحمر', romanization: 'Ahmar', english: 'Red', language: 'arabic' },
        { foreign: 'أزرق', romanization: 'Azraq', english: 'Blue', language: 'arabic' },
        { foreign: 'أخضر', romanization: 'Akhdar', english: 'Green', language: 'arabic' },
        { foreign: 'أسود', romanization: 'Aswad', english: 'Black', language: 'arabic' },
        { foreign: 'أبيض', romanization: 'Abyad', english: 'White', language: 'arabic' },
        { foreign: 'أصفر', romanization: 'Asfar', english: 'Yellow', language: 'arabic' },
        { foreign: 'صباح', romanization: 'Sabaah', english: 'Morning', language: 'arabic' },
        { foreign: 'ليل', romanization: 'Layl', english: 'Night', language: 'arabic' },
        { foreign: 'وقت', romanization: 'Waqt', english: 'Time', language: 'arabic' },
        { foreign: 'مدرسة', romanization: 'Madrasa', english: 'School', language: 'arabic' },
        { foreign: 'صديق', romanization: 'Sadeeq', english: 'Friend', language: 'arabic' },
        { foreign: 'طعام', romanization: 'Taaam', english: 'Food', language: 'arabic' },
        { foreign: 'قلم', romanization: 'Qalam', english: 'Pencil', language: 'arabic' },
        { foreign: 'ساعة', romanization: 'Saaa', english: 'Clock', language: 'arabic' },
        { foreign: 'جورب', romanization: 'Jawrab', english: 'Sock', language: 'arabic' },
    ],
    korean: [
        { foreign: '개', romanization: 'Gae', english: 'Dog', language: 'korean' },
        { foreign: '고양이', romanization: 'Goyangi', english: 'Cat', language: 'korean' },
        { foreign: '집', romanization: 'Jip', english: 'House', language: 'korean' },
        { foreign: '물', romanization: 'Mul', english: 'Water', language: 'korean' },
        { foreign: '빵', romanization: 'Ppang', english: 'Bread', language: 'korean' },
        { foreign: '책', romanization: 'Chaek', english: 'Book', language: 'korean' },
        { foreign: '테이블', romanization: 'Teibeul', english: 'Table', language: 'korean' },
        { foreign: '의자', romanization: 'Uija', english: 'Chair', language: 'korean' },
        { foreign: '창문', romanization: 'Changmun', english: 'Window', language: 'korean' },
        { foreign: '문', romanization: 'Mun', english: 'Door', language: 'korean' },
        { foreign: '차', romanization: 'Cha', english: 'Car', language: 'korean' },
        { foreign: '나무', romanization: 'Namu', english: 'Tree', language: 'korean' },
        { foreign: '꽃', romanization: 'Kkot', english: 'Flower', language: 'korean' },
        { foreign: '하늘', romanization: 'Haneul', english: 'Sky', language: 'korean' },
        { foreign: '바다', romanization: 'Bada', english: 'Sea', language: 'korean' },
        { foreign: '산', romanization: 'San', english: 'Mountain', language: 'korean' },
        { foreign: '강', romanization: 'Gang', english: 'River', language: 'korean' },
        { foreign: '태양', romanization: 'Taeyang', english: 'Sun', language: 'korean' },
        { foreign: '달', romanization: 'Dal', english: 'Moon', language: 'korean' },
        { foreign: '별', romanization: 'Byeol', english: 'Star', language: 'korean' },
        { foreign: '비', romanization: 'Bi', english: 'Rain', language: 'korean' },
        { foreign: '눈', romanization: 'Nun', english: 'Snow', language: 'korean' },
        { foreign: '바람', romanization: 'Baram', english: 'Wind', language: 'korean' },
        { foreign: '불', romanization: 'Bul', english: 'Fire', language: 'korean' },
        { foreign: '돌', romanization: 'Dol', english: 'Stone', language: 'korean' },
        { foreign: '종이', romanization: 'Jongi', english: 'Paper', language: 'korean' },
        { foreign: '열쇠', romanization: 'Yeolsoe', english: 'Key', language: 'korean' },
        { foreign: '길', romanization: 'Gil', english: 'Road', language: 'korean' },
        { foreign: '다리', romanization: 'Dari', english: 'Bridge', language: 'korean' },
        { foreign: '전화', romanization: 'Jeonhwa', english: 'Phone', language: 'korean' },
        { foreign: '음악', romanization: 'Eumak', english: 'Music', language: 'korean' },
        { foreign: '영화', romanization: 'Yeonghwa', english: 'Movie', language: 'korean' },
        { foreign: '사진', romanization: 'Sajin', english: 'Photo', language: 'korean' },
        { foreign: '그림', romanization: 'Geurim', english: 'Picture', language: 'korean' },
        { foreign: '색', romanization: 'Saek', english: 'Color', language: 'korean' },
        { foreign: '빨강', romanization: 'Ppalgang', english: 'Red', language: 'korean' },
        { foreign: '파랑', romanization: 'Parang', english: 'Blue', language: 'korean' },
        { foreign: '초록', romanization: 'Chorok', english: 'Green', language: 'korean' },
        { foreign: '검정', romanization: 'Geomjeong', english: 'Black', language: 'korean' },
        { foreign: '하양', romanization: 'Hayang', english: 'White', language: 'korean' },
        { foreign: '노랑', romanization: 'Norang', english: 'Yellow', language: 'korean' },
        { foreign: '아침', romanization: 'Achim', english: 'Morning', language: 'korean' },
        { foreign: '밤', romanization: 'Bam', english: 'Night', language: 'korean' },
        { foreign: '시간', romanization: 'Sigan', english: 'Time', language: 'korean' },
        { foreign: '학교', romanization: 'Hakgyo', english: 'School', language: 'korean' },
        { foreign: '친구', romanization: 'Chingu', english: 'Friend', language: 'korean' },
        { foreign: '음식', romanization: 'Eumsik', english: 'Food', language: 'korean' },
        { foreign: '연필', romanization: 'Yeonpil', english: 'Pencil', language: 'korean' },
        { foreign: '시계', romanization: 'Sigye', english: 'Clock', language: 'korean' },
        { foreign: '양말', romanization: 'Yangmal', english: 'Sock', language: 'korean' },
    ],
};

export default function MultilingualList() {
    const [gameState, setGameState] = useState<GameState>('setup');

    // Settings
    const [selectedLanguage, setSelectedLanguage] = useState<Language>('japanese');
    const [wordCount, setWordCount] = useState(40);
    const [timePerWord, setTimePerWord] = useState(5); // seconds

    // Game Data
    const [words, setWords] = useState<WordPair[]>([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [recallInput, setRecallInput] = useState<{ [key: number]: string }>({});
    const [startTime, setStartTime] = useState<number>(0);
    const [endTime, setEndTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState(0);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const wordTimerRef = useRef<NodeJS.Timeout | null>(null);

    const startWeek8Challenge = () => {
        setWordCount(40);
        setTimePerWord(4.5); // 3 minutes / 40 words = 4.5s per word
        startGame(40, 4.5);
    };

    const startGame = (count = wordCount, timePerW = timePerWord) => {
        const languageWords = LANGUAGE_DATA[selectedLanguage];
        const shuffled = [...languageWords].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);

        setWords(selected);
        setCurrentWordIndex(0);
        setTimeLeft(timePerW);
        setGameState('memorize');
        setStartTime(Date.now());
        setRecallInput({});
    };

    const nextWord = () => {
        if (currentWordIndex < words.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
            setTimeLeft(timePerWord);
        } else {
            finishMemorization();
        }
    };

    const finishMemorization = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (wordTimerRef.current) clearTimeout(wordTimerRef.current);
        setEndTime(Date.now());

        // Shuffle for recall
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        setWords(shuffled);

        setGameState('recall');
    };

    const handleInputChange = (idx: number, value: string) => {
        setRecallInput(prev => ({
            ...prev,
            [idx]: value
        }));
    };

    const submitRecall = async () => {
        const correctCount = calculateScore();
        const memorizeTimeSeconds = Math.floor((endTime - startTime) / 1000);

        await saveGameResult({
            type: 'multilingual-list',
            count: wordCount,
            correct: correctCount,
            total: words.length,
            percentage: Math.round((correctCount / words.length) * 100),
            memorizeTime: memorizeTimeSeconds,
            recallTime: 0,
            precision: Math.round((correctCount / words.length) * 100),
            completeness: 100,
        });

        setGameState('result');
    };

    // Timer Logic
    useEffect(() => {
        if (gameState === 'memorize' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        nextWord();
                        return timePerWord;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState, currentWordIndex]);

    const calculateScore = () => {
        let correct = 0;
        words.forEach((word, idx) => {
            const input = recallInput[idx]?.trim().toLowerCase() || '';
            const expected = word.english.toLowerCase();
            if (input === expected) correct++;
        });
        return correct;
    };

    const formatTime = (seconds: number) => {
        return `${seconds.toFixed(1)}s`;
    };

    const currentWord = words[currentWordIndex];

    return (
        <>
            <Header />
            <main className="container" style={{ maxWidth: '900px' }}>

                <div style={{ marginBottom: '2rem' }}>
                    <Link href="/training" style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.5rem', display: 'inline-block' }}>
                        ← Back to Training
                    </Link>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>The Multilingual List</h1>
                    <p style={{ opacity: 0.7, marginTop: '0.5rem' }}>Phonetic Bridge Training</p>
                </div>

                {gameState === 'setup' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Configuration</h2>

                        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Language</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                                    {(Object.keys(LANGUAGE_DATA) as Language[]).map(lang => (
                                        <button
                                            key={lang}
                                            className={`btn ${selectedLanguage === lang ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setSelectedLanguage(lang)}
                                            style={{ textTransform: 'capitalize' }}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Word Count</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={wordCount}
                                    onChange={(e) => setWordCount(Math.min(parseInt(e.target.value) || 0, 50))}
                                    max={50}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Time Per Word (Seconds)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    step="0.5"
                                    value={timePerWord}
                                    onChange={(e) => setTimePerWord(parseFloat(e.target.value) || 1)}
                                />
                            </div>
                        </div>

                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--success)' }}>How to Play</h3>
                            <ul style={{ fontSize: '0.9rem', opacity: 0.9, lineHeight: '1.6', paddingLeft: '1.5rem' }}>
                                <li>Each word appears for {timePerWord} seconds</li>
                                <li>Create a phonetic substitute (sound-alike) for the foreign word</li>
                                <li>Link the phonetic image to the English meaning</li>
                                <li>Example: "Kutsushita" (Sock) → "Coot Shoe Star" → Image of a shoe</li>
                            </ul>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <button className="btn btn-primary" onClick={() => startGame()}>
                                Start Custom Game
                            </button>

                            <div style={{ borderTop: '1px solid var(--glass-border)', margin: '1rem 0' }}></div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold' }}>Week 8 Challenge</h3>
                                    <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>40 Words • 3 Minutes • 35+ Correct</p>
                                </div>
                                <button className="btn btn-secondary" onClick={startWeek8Challenge} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                                    Start Challenge
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'memorize' && currentWord && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '0.5rem' }}>
                                Word {currentWordIndex + 1} of {words.length}
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: timeLeft < 2 ? 'var(--error)' : 'var(--primary)' }}>
                                {formatTime(timeLeft)}
                            </div>
                        </div>

                        <div className="glass card" style={{ padding: '3rem', textAlign: 'center', minHeight: '400px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem', fontWeight: 'bold' }}>
                                {currentWord.foreign}
                            </div>
                            <div style={{ fontSize: '2rem', marginBottom: '2rem', color: 'var(--accent)', opacity: 0.8 }}>
                                {currentWord.romanization}
                            </div>
                            <div style={{ fontSize: '1.5rem', color: 'var(--success)' }}>
                                {currentWord.english}
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button className="btn btn-secondary" onClick={nextWord}>
                                Next Word →
                            </button>
                            <button className="btn btn-primary" style={{ marginLeft: '1rem' }} onClick={finishMemorization}>
                                Finish Early
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'recall' && (
                    <div className="animate-fade-in">
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Recall Phase</h2>
                                <p style={{ opacity: 0.7 }}>Type the English translation</p>
                            </div>
                            <button className="btn btn-primary" onClick={submitRecall}>
                                Submit Recall
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                            {words.map((word, idx) => (
                                <div key={idx} className="glass" style={{ padding: '1rem', borderRadius: '0.5rem' }}>
                                    <div style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                            {word.foreign}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                            {word.romanization}
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="English translation"
                                        className="input-field"
                                        style={{ padding: '0.5rem' }}
                                        value={recallInput[idx] || ''}
                                        onChange={(e) => handleInputChange(idx, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button className="btn btn-primary" style={{ width: '100%', maxWidth: '300px' }} onClick={submitRecall}>
                                Submit Recall
                            </button>
                        </div>
                    </div>
                )}

                {gameState === 'result' && (
                    <div className="glass card animate-fade-in">
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>Results</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Score</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                    {calculateScore()} / {words.length}
                                </div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Percentage</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: calculateScore() >= 35 ? 'var(--success)' : 'var(--error)' }}>
                                    {Math.round((calculateScore() / words.length) * 100)}%
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>Target: 87.5%</div>
                            </div>

                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Time</div>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {Math.floor((endTime - startTime) / 1000)}s
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Review</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                                {words.map((word, idx) => {
                                    const input = recallInput[idx]?.trim().toLowerCase() || '';
                                    const expected = word.english.toLowerCase();
                                    const isCorrect = input === expected;

                                    return (
                                        <div key={idx} className="glass-panel" style={{
                                            padding: '1rem',
                                            border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--error)'}`,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '0.5rem'
                                        }}>
                                            <div style={{ flex: '1 1 200px' }}>
                                                <div style={{ fontWeight: 'bold' }}>{word.foreign} ({word.romanization})</div>
                                                <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>Correct: {word.english}</div>
                                            </div>
                                            <div style={{ flex: '1 1 150px', textAlign: 'right' }}>
                                                <div style={{ color: isCorrect ? 'var(--success)' : 'var(--error)' }}>
                                                    Your answer: {input || '(blank)'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setGameState('setup')}>
                                New Game
                            </button>
                            <Link href="/training" className="btn btn-primary" style={{ flex: 1 }}>
                                Back to Hub
                            </Link>
                        </div>
                    </div>
                )}


            </main>
        </>
    );
}
