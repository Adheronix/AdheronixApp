#!/usr/bin/env python3
"""Build for the detected Uno using Debian's arduino-core-avr and gcc-avr."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
core = Path('/usr/share/arduino/hardware/arduino/avr/cores/arduino')
variant = core.parent.parent / 'variants/standard'
build = root / 'build'
build.mkdir(exist_ok=True)
flags = ['-mmcu=atmega328p', '-DF_CPU=16000000L', '-DARDUINO=10819',
         '-DARDUINO_AVR_UNO', '-DARDUINO_ARCH_AVR', '-Os', '-ffunction-sections',
         '-fdata-sections', '-I' + str(core), '-I' + str(variant)]
objects = []
sources = list(core.glob('*.c')) + list(core.glob('*.cpp')) + list(core.glob('*.S'))
sources.append(root / 'motor_controller/motor_controller.ino')
for source in sources:
    obj = build / (source.name + '.o')
    cpp = source.suffix in ('.cpp', '.ino')
    command = ['avr-g++' if cpp else 'avr-gcc', *flags]
    if cpp:
        command += ['-std=gnu++11', '-fpermissive', '-fno-exceptions', '-fno-threadsafe-statics']
    if source.suffix == '.ino':
        command += ['-x', 'c++']
    subprocess.run([*command, '-c', str(source), '-o', str(obj)], check=True)
    objects.append(str(obj))
elf = build / 'motor_controller.elf'
subprocess.run(['avr-gcc', '-mmcu=atmega328p', '-Wl,--gc-sections', '-o', str(elf), *objects, '-lm'], check=True)
subprocess.run(['avr-objcopy', '-O', 'ihex', '-R', '.eeprom', str(elf), str(build / 'motor_controller.hex')], check=True)
subprocess.run(['avr-size', '--format=avr', '--mcu=atmega328p', str(elf)], check=True)
