import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TagZone from '../src/components/common/TagZone.vue'

describe('TagZone', () => {
  it('renders "Morgana\'s Rest" in the correct color when proximityTo is "Morgana\'s Rest"', () => {
    const wrapper = mount(TagZone, {
      props: {
        type: 'outlands',
        proximityTo: "Morgana's Rest"
      }
    })
    
    expect(wrapper.text()).toBe("Morgana's Rest")
    // Check if it's the right color. bgColor #1f1f1f is rgb(31, 31, 31)
    const element = wrapper.find('span')
    expect(element.element.style.backgroundColor).toBe('rgb(31, 31, 31)')
  })

  it('renders "Merlyn\'s Rest" in the correct color when proximityTo is "Merlyn\'s Rest"', () => {
    const wrapper = mount(TagZone, {
      props: {
        type: 'outlands',
        proximityTo: "Merlyn's Rest"
      }
    })
    
    expect(wrapper.text()).toBe("Merlyn's Rest")
    const element = wrapper.find('span')
    expect(element.element.style.backgroundColor).toBe('rgb(31, 31, 31)')
  })

  it('renders "Arthur\'s Rest" in the correct color when proximityTo is "Arthur\'s Rest"', () => {
    const wrapper = mount(TagZone, {
      props: {
        type: 'outlands',
        proximityTo: "Arthur's Rest"
      }
    })
    
    expect(wrapper.text()).toBe("Arthur's Rest")
    const element = wrapper.find('span')
    expect(element.element.style.backgroundColor).toBe('rgb(31, 31, 31)')
  })
})
