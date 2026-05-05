import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import TagZone from '../src/components/common/TagZone.vue'

describe('TagZone', () => {
  it('renders "Morgana\'s Rest" in green when proximityTo is "Morgana\'s Rest"', () => {
    const wrapper = mount(TagZone, {
      props: {
        type: 'outlands',
        proximityTo: "Morgana's Rest"
      }
    })
    
    expect(wrapper.text()).toBe("Morgana's Rest")
    // Check if it's green. The bgColor for MorganasRest is #228B22
    const element = wrapper.find('span')
    // rgb(34, 139, 34) is #228B22
    console.log('Background Color:', element.element.style.backgroundColor);
    expect(element.element.style.backgroundColor).toBe('rgb(34, 139, 34)')
  })

  it('renders "Morgana\'s Rest" for Drownfield Mire using proximityTo', () => {
    const wrapper = mount(TagZone, {
      props: {
        type: 'outlands',
        zoneName: 'Drownfield Mire',
        proximityTo: "Morgana's Rest"
      }
    })
    
    expect(wrapper.text()).toBe("Morgana's Rest")
  })

  it('renders "Arthur\'s Rest" for Battlebrae Peaks using proximityTo', () => {
    const wrapper = mount(TagZone, {
      props: {
        type: 'outlands',
        zoneName: 'Battlebrae Peaks',
        proximityTo: "Arthur's Rest"
      }
    })
    
    expect(wrapper.text()).toBe("Arthur's Rest")
  })
})
