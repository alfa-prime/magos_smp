"""
Список правил для корректировки названия профиля койки
на основе кода диагноза, так как в ЕВМИАС не всегда правильно

Каждое правило - словарь с паттерном и заменой

Правила применяются по порядку, если совпадение найдено, то остальные правила не применяются
"""
import re

bed_profile_correction_rules = {
    "Отделение реабилитации": [
        {
            "pattern": re.compile(r"^(M(16|17)\.\d)$"),
            "replacement": "реабилитационные для больных с заболеваниями опорно-двигательного аппарата "
                           "и периферической нервной системы"
        },
        {
            "pattern": re.compile(r"^M42\.1$"),
            "replacement": "реабилитационные для больных с заболеваниями опорно-двигательного аппарата "
                           "и периферической нервной системы"
        },
        {
            "pattern": re.compile(r"^I\d+\.\d$"),
            "replacement": "реабилитационные для больных с заболеваниями центральной нервной системы и органов чувств"
        },
        {
            "pattern": re.compile(r"^G\d+\.\d$"),
            "replacement": "реабилитационные для больных с заболеваниями опорно-двигательного аппарата "
                           "и периферической нервной системы"
        },
    ],
    "Хирургическое отделение №1": [
        {
            "pattern": re.compile(r"^I83.9$"),
            "replacement": "сосудистой хирургии"
        },
        {
            "pattern": re.compile(r"^K6[0-4]\.\d$"),
            "replacement": "проктологические"
        },
        {
            "pattern": re.compile(r"^D12\.\d$"),
            "replacement": "проктологические"
        },
        {
            "pattern": re.compile(r"^(K4[0-6]\.\d|K80\.1)$"),
            "replacement": "абдоминальной хирургии"
        },
        {
            "pattern": re.compile(r"^(K01\.\d|K04\.\d)$"),
            "replacement": "хирургические (хирургия)"
        },
        {
            "pattern": re.compile(r"^(I70\.2|I70\.8)$"),
            "replacement": "сосудистой хирургии"
        },
        {
            "pattern": re.compile(r"^J34\.\d$"),
            "replacement": "оториноларингологические"
        },
    ],
    "Хирургическое отделение №2": [
        {
            "pattern": re.compile(r"^I83.9$"),
            "replacement": "сосудистой хирургии"
        },
        {
            "pattern": re.compile(r"^K6[0-4]\.\d$"),
            "replacement": "проктологические"
        },
        {
            "pattern": re.compile(r"^D12\.\d$"),
            "replacement": "проктологические"
        },
        {
            "pattern": re.compile(r"^(K4[0-6]\.\d|K80\.1)$"),
            "replacement": "абдоминальной хирургии"
        },
        {
            "pattern": re.compile(r"^(I70\.2|I70\.8)$"),
            "replacement": "сосудистой хирургии"
        },
        {
            "pattern": re.compile(r"^(K01\.\d|K04\.\d)$"),
            "replacement": "хирургические (хирургия)"
        },
        {
            "pattern": re.compile(r"^J34\.\d$"),
            "replacement": "оториноларингологические"
        },
    ],
    "Дневной стационар": [
        {
            "pattern": re.compile(r"^I83.9$"),
            "replacement": "сосудистой хирургии"
        },
        {
            "pattern": re.compile(r"^K6[0-4]\.\d$"),
            "replacement": "проктологические"
        },
        {
            "pattern": re.compile(r"^D12\.\d$"),
            "replacement": "проктологические"
        },
        {
            "pattern": re.compile(r"^(K4[0-6]\.\d|K80\.1)$"),
            "replacement": "абдоминальной хирургии"
        },
        {
            "pattern": re.compile(r"^(I70\.2|I70\.8)$"),
            "replacement": "сосудистой хирургии"
        },
        {
            "pattern": re.compile(r"^(K01\.\d|K04\.\d)$"),
            "replacement": "хирургические (хирургия)"
        },
        {
            "pattern": re.compile(r"^J34\.\d$"),
            "replacement": "оториноларингологические"
        },
    ],
    "Неврология": [
        {
            "pattern": re.compile(r"^(M42\.1|M51\.1)$"),
            "replacement": "нейрохирургические"
        },
        {
            "pattern": re.compile(r"^(I65.3)$"),
            "replacement": "сосудистой хирургии"
        },
    ]
}


